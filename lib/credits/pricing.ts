import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { planFor, type PlanTier } from "@/lib/plans";
import type { Database } from "@/lib/supabase/database.types";
import { MODEL_ENGINE_LABELS } from "@/lib/validation/jobs";
import { falModelFor } from "@/lib/ai/falModels";
import type { AssetType, JobInput, Model3dInput, MusicInput, SfxInput, VoiceInput } from "@/lib/validation/jobs";
import { ApiError } from "@/lib/api";

export type PricingRow = Database["public"]["Tables"]["model_pricing"]["Row"];

let cache: { at: number; rows: Map<string, PricingRow> } | null = null;

/** model_pricing (admin-editable, SPEC §8.4/§11.1). Cached for 60 s. */
export async function loadPricing(force = false): Promise<Map<string, PricingRow>> {
  if (!force && cache && Date.now() - cache.at < 60_000) return cache.rows;
  const { data, error } = await supabaseAdmin().from("model_pricing").select("*");
  if (error) throw error;
  cache = { at: Date.now(), rows: new Map((data ?? []).map((r) => [r.id, r])) };
  return cache.rows;
}

export interface EstimateLine {
  pricing_id: string;
  label: string;
  qty: number;
  credits: number; // per unit
  total: number;
}

export interface Estimate {
  credits: number;
  lines: EstimateLine[];
  provider: string;
  provider_model: string;
  est_cost_usd: number;
}

function row(p: Map<string, PricingRow>, id: string): PricingRow {
  const r = p.get(id);
  if (!r) throw new ApiError("pricing_missing", `Pricing entry ${id} is missing`, 500);
  if (!r.enabled) throw new ApiError("pipeline_disabled", `${id} is currently disabled`, 400);
  return r;
}

/** SPEC §11.2 — job cost = sum of line items × count. Also validates plan gates (§16.3). */
export async function estimateJob(type: AssetType, input: JobInput, plan: PlanTier): Promise<Estimate> {
  const p = await loadPricing();
  const cfg = planFor(plan);
  const lines: EstimateLine[] = [];
  let provider = "";
  let cost = 0;

  const add = (r: PricingRow, label: string, qty: number, unit = r.credits) => {
    lines.push({ pricing_id: r.id, label, qty, credits: unit, total: unit * qty });
    cost += Number(r.est_provider_cost_usd) * qty;
  };

  switch (type) {
    case "model_3d": {
      const m = input as Model3dInput;
      if (m.images.length > cfg.maxInputImages) {
        throw new ApiError(
          "plan_limit",
          cfg.maxInputImages === 1
            ? "Attaching more than one photo requires the Pro or Studio plan"
            : `This plan allows up to ${cfg.maxInputImages} input photos`,
          403,
        );
      }
      // The engine is the base line item: Rodin costs more credits than TRELLIS (SPEC §9.3).
      const base = row(p, `model3d.engine.${m.engine}`);
      provider = base.provider;
      add(base, `3D — ${MODEL_ENGINE_LABELS[m.engine].name}`, 1);
      if (!cfg.textures4k && m.texture_resolution === "4K") {
        throw new ApiError("plan_limit", "4K textures require the Studio plan", 403);
      }
      // HD texture post-processing / 4K HighPack exist on Rodin only (SPEC §9.7).
      if (m.engine === "rodin" && (m.quality === "high" || m.texture_resolution === "4K")) {
        add(row(p, "model3d.high_addon"), "High quality textures", 1);
      }
      // Rig / animation add-ons are charged only once their provider is wired (`provider <> 'unbound'`).
      const rig = row(p, "model3d.rig_addon");
      if (m.rig && rig.provider !== "unbound") add(rig, "Auto-rig", 1);
      const anim = row(p, "model3d.animation_addon");
      if (m.rig && m.animations.length && anim.provider !== "unbound") add(anim, "3D animation clips", m.animations.length);
      break;
    }
    case "audio_sfx": {
      const s = input as SfxInput;
      const r = row(p, "sfx.variant");
      provider = r.provider;
      add(r, "SFX variant", s.count);
      break;
    }
    case "audio_music": {
      const m = input as MusicInput;
      // Priced by the requested length (15 s is billed as 30 s), SPEC §11.2.
      const d = Math.max(30, m.duration_s) as 30 | 60 | 120 | 180;
      const r = row(p, `music.lyria3.${d}s`);
      provider = r.provider;
      add(r, `Music (${d} s)`, 1);
      break;
    }
    case "audio_voice": {
      const v = input as VoiceInput;
      const r = row(p, "voice.per_100_chars");
      provider = r.provider;
      const units = Math.max(1, Math.ceil(v.text.length / 100));
      add(r, `Voice — ${v.text.length} characters`, units);
      break;
    }
  }

  // The exact endpoint (e.g. Rodin text- vs image-to-3D) comes from the model registry (SPEC §9.7).
  const providerModel = falModelFor(type, input).endpoint;
  const credits = Math.max(0, lines.reduce((s, l) => s + l.total, 0));
  return { credits, lines, provider, provider_model: providerModel, est_cost_usd: Number(cost.toFixed(4)) };
}
