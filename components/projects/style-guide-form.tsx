"use client";

import * as React from "react";
import { XIcon } from "lucide-react";
import { Input, Label, Textarea } from "@/components/ui/primitives";
import { Select, Switch } from "@/components/ui/overlays";
import { Button } from "@/components/ui/button";
import { ART_STYLES, PERSPECTIVES, PIXEL_GRIDS, TARGET_ENGINES, type StyleGuide } from "@/lib/validation/project";

/** SPEC §7.1 / §17.4 — style guide editor incl. palette picker (color input + hex paste). */
export function StyleGuideForm({ value, onChange }: { value: StyleGuide; onChange: (v: StyleGuide) => void }) {
  const set = <K extends keyof StyleGuide>(k: K, v: StyleGuide[K]) => onChange({ ...value, [k]: v });
  const [hexInput, setHexInput] = React.useState("");
  const palette = value.palette ?? [];

  const addHex = () => {
    const found = hexInput.match(/#?[0-9a-fA-F]{6}/g) ?? [];
    const next = [...palette];
    for (const h of found) {
      const v = (h.startsWith("#") ? h : "#" + h).toLowerCase();
      if (!next.includes(v) && next.length < 64) next.push(v);
    }
    set("palette", next);
    setHexInput("");
  };

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="grid gap-2">
        <Label>Art style</Label>
        <Select
          value={value.art_style ?? ""}
          onValueChange={(v) => {
            set("art_style", v || null);
            if (v === "pixel art" && !value.pixel_grid) onChange({ ...value, art_style: v, pixel_grid: 32 });
          }}
          options={ART_STYLES.map((s) => ({ value: s, label: s }))}
          placeholder="Choose a style"
        />
        {value.art_style === "custom" && <Input placeholder="Describe the style" value={value.style_notes ?? ""} onChange={(e) => set("style_notes", e.target.value)} />}
      </div>
      <div className="grid gap-2">
        <Label>Perspective</Label>
        <Select value={value.perspective ?? ""} onValueChange={(v) => set("perspective", (v || null) as StyleGuide["perspective"])} options={PERSPECTIVES.map((p) => ({ value: p, label: p }))} placeholder="Any" />
      </div>
      <div className="grid gap-2">
        <Label>Pixel grid (pixel art only)</Label>
        <Select value={value.pixel_grid ? String(value.pixel_grid) : "none"} onValueChange={(v) => set("pixel_grid", v === "none" ? null : Number(v))} options={[{ value: "none", label: "Not pixel art" }, ...PIXEL_GRIDS.map((g) => ({ value: String(g), label: `${g} px` }))]} />
      </div>
      <div className="grid gap-2">
        <Label>Target engine</Label>
        <Select value={value.target_engine ?? "none"} onValueChange={(v) => set("target_engine", v === "none" ? null : (v as StyleGuide["target_engine"]))} options={[{ value: "none", label: "No default" }, ...TARGET_ENGINES.map((e) => ({ value: e, label: e }))]} />
      </div>
      <div className="grid gap-2 md:col-span-2">
        <Label>Mood</Label>
        <Input placeholder="dark fantasy, cozy, sci-fi…" value={value.mood ?? ""} onChange={(e) => set("mood", e.target.value)} />
      </div>
      {value.art_style !== "custom" && (
        <div className="grid gap-2 md:col-span-2">
          <Label>Style notes</Label>
          <Textarea placeholder="chunky outlines, 3/4 top-down perspective…" value={value.style_notes ?? ""} onChange={(e) => set("style_notes", e.target.value)} />
        </div>
      )}
      <div className="grid gap-2 md:col-span-2">
        <Label>Audio notes</Label>
        <Input placeholder="chiptune, 8-bit / orchestral…" value={value.audio_notes ?? ""} onChange={(e) => set("audio_notes", e.target.value)} />
      </div>
      <div className="grid gap-2 md:col-span-2">
        <div className="flex items-center justify-between">
          <Label>Palette ({palette.length}/64)</Label>
          <label className="flex items-center gap-2 text-xs">
            Lock palette (quantize pixel art to it)
            <Switch checked={Boolean(value.palette_locked)} onCheckedChange={(v) => set("palette_locked", v)} disabled={!palette.length} />
          </label>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {palette.map((c, i) => (
            <span key={c + i} className="group relative inline-flex size-7 items-center justify-center rounded border" style={{ background: c }} title={c}>
              <button type="button" onClick={() => set("palette", palette.filter((_, j) => j !== i))} className="bg-background/80 absolute inset-0 hidden items-center justify-center rounded group-hover:flex cursor-pointer" aria-label={`Remove ${c}`}>
                <XIcon className="size-3" />
              </button>
            </span>
          ))}
          <input type="color" aria-label="Pick a color" className="size-7 cursor-pointer rounded border bg-transparent p-0" onChange={(e) => set("palette", [...palette, e.target.value].slice(0, 64))} />
        </div>
        <div className="flex gap-2">
          <Input placeholder="Paste hex colors: #1a1c2c #5d275d …" value={hexInput} onChange={(e) => setHexInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addHex())} />
          <Button type="button" variant="outline" onClick={addHex}>
            Add
          </Button>
        </div>
      </div>
    </div>
  );
}
