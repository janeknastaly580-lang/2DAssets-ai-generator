"use client";

import { ImageRef, MultiReferencePicker, NumberField, PromptField, SelectField, ToggleRow } from "./fields";
import { Checkbox } from "@/components/ui/overlays";
import { RIG_ANIMATIONS, MODEL_ENGINES, MODEL_ENGINE_LABELS } from "@/lib/validation/jobs";
import type { ModelEngine } from "@/lib/validation/jobs";
import type { StyleGuide } from "@/lib/validation/project";
import type { PlanTier } from "@/lib/plans";
import { PLANS } from "@/lib/plans";

export interface FormProps<T> {
  value: T;
  onChange: (v: T) => void;
  styleGuide: StyleGuide | null;
  references: { id: string; kind: string; label: string | null; url: string }[];
  plan: PlanTier;
}

/* ------------------------------- §9.3 3D ----------------------------------- */
export interface Model3dFormValue {
  prompt: string;
  images: ImageRef[];
  engine: ModelEngine;
  quality: "fast" | "standard" | "high";
  target_polycount: 1000 | 5000 | 20000 | 100000;
  topology: "triangle" | "quad";
  pbr: boolean;
  texture_resolution: "1K" | "2K" | "4K";
  rig: boolean;
  animations: string[];
  real_world_size_m: number | null;
  parent_asset_id: string | null;
}

export const defaultModel3dForm = (): Model3dFormValue => ({
  prompt: "",
  images: [],
  engine: "rodin",
  quality: "standard",
  target_polycount: 20000,
  topology: "triangle",
  pbr: true,
  texture_resolution: "2K",
  rig: false,
  animations: [],
  real_world_size_m: null,
  parent_asset_id: null,
});

export function Model3dForm({ value, onChange, references, plan }: FormProps<Model3dFormValue>) {
  const set = <K extends keyof Model3dFormValue>(k: K, v: Model3dFormValue[K]) => onChange({ ...value, [k]: v });
  const can4k = PLANS[plan].textures4k;
  // TRELLIS (SPEC §9.7): exactly one photo, triangles only, textures up to 2K, always textured.
  const trellis = value.engine === "trellis";
  const maxImages = trellis ? 1 : PLANS[plan].maxInputImages;
  const setEngine = (engine: ModelEngine) =>
    onChange(
      engine === "trellis"
        ? { ...value, engine, images: value.images.slice(0, 1), topology: "triangle", texture_resolution: value.texture_resolution === "4K" ? "2K" : value.texture_resolution }
        : { ...value, engine },
    );
  return (
    <div className="grid gap-4">
      <PromptField
        value={value.prompt}
        onChange={(v) => set("prompt", v)}
        placeholder="A wooden treasure chest with iron bands"
      />
      <MultiReferencePicker
        label={trellis ? "Photo (required)" : "Photos (optional)"}
        values={value.images}
        onChange={(v) => set("images", v)}
        references={references}
        max={maxImages}
        limitNote={trellis ? "TRELLIS uses a single photo" : undefined}
        hint={
          trellis
            ? "TRELLIS needs exactly one photo. The prompt is not sent to it — it only tunes the generation settings."
            : "Attach photos to drive the shape. Prompt and photos can be combined — the prompt then guides the result."
        }
      />
      <SelectField
        label="Engine"
        value={value.engine}
        onChange={setEngine}
        options={MODEL_ENGINES.map((e) => ({ value: e, label: MODEL_ENGINE_LABELS[e].name }))}
        hint={MODEL_ENGINE_LABELS[value.engine].note}
      />
      <div className="grid grid-cols-2 gap-3">
        <SelectField label="Quality" value={value.quality} onChange={(v) => set("quality", v)} options={[{ value: "fast", label: "Fast" }, { value: "standard", label: "Standard" }, { value: "high", label: "High (hi-res textures)" }]} />
        <SelectField label="Polycount" value={String(value.target_polycount)} onChange={(v) => set("target_polycount", Number(v) as Model3dFormValue["target_polycount"])} options={[1000, 5000, 20000, 100000].map((p) => ({ value: String(p), label: `${p / 1000}k` }))} />
        <SelectField label="Topology" value={value.topology} onChange={(v) => set("topology", v)} options={[{ value: "triangle", label: "Triangles" }, { value: "quad", label: trellis ? "Quads (Rodin only)" : "Quads", disabled: trellis }]} />
        <SelectField label="Texture resolution" value={value.texture_resolution} onChange={(v) => set("texture_resolution", v)} options={[{ value: "1K", label: "1K" }, { value: "2K", label: "2K" }, { value: "4K", label: trellis ? "4K (Rodin only)" : can4k ? "4K" : "4K (Studio)", disabled: trellis || !can4k }]} />
      </div>
      <NumberField label="Real-world size (m)" value={value.real_world_size_m} onChange={(v) => set("real_world_size_m", v)} min={0.01} step={0.1} hint="Default 1 m" />
      <ToggleRow label="PBR textures" hint={trellis ? "TRELLIS always bakes its own textures" : undefined} checked={value.pbr} disabled={trellis} onCheckedChange={(v) => set("pbr", v)} />
      <ToggleRow
        label="Auto-rig (humanoid)"
        hint="Rigging & animation clips are coming soon — for now Rodin models the character in a T/A-pose, ready to rig, and the rig isn't charged."
        checked={value.rig}
        onCheckedChange={(v) => onChange({ ...value, rig: v, animations: v ? value.animations : [] })}
      />
      {value.rig && (
        <div className="grid grid-cols-3 gap-1.5 pl-3">
          {RIG_ANIMATIONS.map((a) => (
            <label key={a} className="flex items-center gap-2 text-xs">
              <Checkbox checked={value.animations.includes(a)} onCheckedChange={() => set("animations", value.animations.includes(a) ? value.animations.filter((x) => x !== a) : [...value.animations, a])} /> {a}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
