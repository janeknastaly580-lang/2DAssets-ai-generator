import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";

let cache: { at: number; rows: Map<string, { enabled: boolean; payload: unknown }> } | null = null;

/** feature_flags (SPEC §19 Flags). Cached for 30 s. */
export async function loadFlags(force = false) {
  if (!force && cache && Date.now() - cache.at < 30_000) return cache.rows;
  const { data } = await supabaseAdmin().from("feature_flags").select("*");
  cache = { at: Date.now(), rows: new Map((data ?? []).map((r) => [r.key, { enabled: r.enabled, payload: r.payload }])) };
  return cache.rows;
}

export async function isFlagEnabled(key: string, fallback = true): Promise<boolean> {
  const rows = await loadFlags();
  const f = rows.get(key);
  return f ? f.enabled : fallback;
}

export async function getFlag<T>(key: string): Promise<T | null> {
  const rows = await loadFlags();
  const f = rows.get(key);
  return f ? (f.payload as T) : null;
}

export const PIPELINE_FLAG: Record<string, string> = {
  model_3d: "pipeline.model3d.enabled",
  audio_sfx: "pipeline.sfx.enabled",
  audio_music: "pipeline.music.enabled",
  audio_voice: "pipeline.voice.enabled",
};
