"use client";

import { Field, NumberField, PromptField, SelectField, ToggleRow } from "./fields";
import { Input, Textarea } from "@/components/ui/primitives";
import { Slider } from "@/components/ui/overlays";
import { MUSIC_DURATIONS, SFX_MAX_DURATION_S, VOICE_LANGUAGES, VOICE_SPEED_MAX, VOICE_SPEED_MIN } from "@/lib/validation/jobs";
import type { StyleGuide } from "@/lib/validation/project";

/* -------------------------------- §9.4 SFX --------------------------------- */
export interface SfxFormValue {
  prompt: string;
  duration_s: number | null;
  loop: boolean;
  prompt_influence: number;
  count: number;
}
export const defaultSfxForm = (): SfxFormValue => ({ prompt: "", duration_s: null, loop: false, prompt_influence: 0.3, count: 1 });

export function SfxForm({ value, onChange }: { value: SfxFormValue; onChange: (v: SfxFormValue) => void }) {
  const set = <K extends keyof SfxFormValue>(k: K, v: SfxFormValue[K]) => onChange({ ...value, [k]: v });
  return (
    <div className="grid gap-4">
      <PromptField value={value.prompt} onChange={(v) => set("prompt", v)} max={450} placeholder="Short sword swing with a metallic whoosh" rows={3} />
      <div className="grid grid-cols-2 gap-3">
        <NumberField label="Duration (s)" value={value.duration_s} onChange={(v) => set("duration_s", v === null ? null : Math.min(SFX_MAX_DURATION_S, v))} min={0.5} max={SFX_MAX_DURATION_S} step={0.5} hint={`Empty = auto · max ${SFX_MAX_DURATION_S} s`} />
        <NumberField label="Variants" value={value.count} onChange={(v) => set("count", Math.max(1, Math.min(4, v ?? 1)))} min={1} max={4} />
      </div>
      <Field label={`Prompt influence: ${value.prompt_influence.toFixed(2)}`} hint="Higher = follows the prompt more literally">
        <Slider value={value.prompt_influence} onValueChange={(v) => set("prompt_influence", v)} min={0} max={1} step={0.05} />
      </Field>
      <ToggleRow label="Loopable" hint="Asks for a loopable sound and crossfades the seam" checked={value.loop} onCheckedChange={(v) => set("loop", v)} />
    </div>
  );
}

/* ------------------------------- §9.5 Music (Lyria 3 Pro) -------------------- */
export interface MusicFormValue {
  prompt: string;
  duration_s: (typeof MUSIC_DURATIONS)[number];
  instrumental: boolean;
  loopable: boolean;
  bpm: number | null;
  key: string | null;
}
export const defaultMusicForm = (sg: StyleGuide | null): MusicFormValue => ({ prompt: sg?.audio_notes ? `${sg.audio_notes}, ` : "", duration_s: 30, instrumental: true, loopable: false, bpm: null, key: null });

export function MusicForm({ value, onChange }: { value: MusicFormValue; onChange: (v: MusicFormValue) => void }) {
  const set = <K extends keyof MusicFormValue>(k: K, v: MusicFormValue[K]) => onChange({ ...value, [k]: v });
  return (
    <div className="grid gap-4">
      <PromptField value={value.prompt} onChange={(v) => set("prompt", v)} placeholder="Cozy chiptune town theme, 110 bpm, bright square leads" />
      <div className="grid grid-cols-2 gap-3">
        <SelectField label="Duration" value={String(value.duration_s)} onChange={(v) => set("duration_s", Number(v) as MusicFormValue["duration_s"])} options={MUSIC_DURATIONS.map((d) => ({ value: String(d), label: `${d} s` }))} hint="Approximate — Lyria composes to the requested length" />
        <NumberField label="BPM (optional)" value={value.bpm} onChange={(v) => set("bpm", v)} min={40} max={300} />
        <Field label="Key (optional)">
          <Input className="h-8" value={value.key ?? ""} onChange={(e) => set("key", e.target.value || null)} placeholder="A minor" />
        </Field>
      </div>
      <ToggleRow label="Instrumental" checked={value.instrumental} onCheckedChange={(v) => set("instrumental", v)} />
      <ToggleRow label="Loopable version" hint="Adds a _loop variant with a crossfaded seam" checked={value.loopable} onCheckedChange={(v) => set("loopable", v)} />
    </div>
  );
}

/* ------------------------------- §9.6 Voice -------------------------------- */
export interface VoiceFormValue {
  text: string;
  language: string;
  instructions: string;
  stability: number;
  similarity_boost: number;
  style: number;
  speed: number;
}
export const defaultVoiceForm = (sg: StyleGuide | null): VoiceFormValue => ({
  text: "",
  language: sg?.voice_defaults?.language ?? "en",
  instructions: "",
  stability: 0.5,
  similarity_boost: 0.75,
  style: 0,
  speed: 1,
});

export function VoiceForm({ value, onChange }: { value: VoiceFormValue; onChange: (v: VoiceFormValue) => void }) {
  const set = <K extends keyof VoiceFormValue>(k: K, v: VoiceFormValue[K]) => onChange({ ...value, [k]: v });
  const lines = value.text.split(/\r?\n/).filter((l) => l.trim()).length;
  return (
    <div className="grid gap-4">
      <Field label={`Lines (${lines} cue${lines === 1 ? "" : "s"}, ${value.text.length}/5000 chars)`} hint="One line = one cue = one audio file; multiple lines are also zipped.">
        <Textarea value={value.text} onChange={(e) => set("text", e.target.value.slice(0, 5000))} rows={5} placeholder={"Welcome, traveler.\nThe dungeon awaits."} />
      </Field>
      <Field label="Instructions" hint="Required. Voice, emotion, pacing, character — translated for the model; the spoken text is never changed.">
        <Input className="h-8" value={value.instructions} onChange={(e) => set("instructions", e.target.value.slice(0, 300))} placeholder="tired old wizard, slow and raspy, deep male voice" />
      </Field>
      <SelectField label="Language" value={value.language} onChange={(v) => set("language", v)} options={VOICE_LANGUAGES.map((l) => ({ value: l.code, label: l.label }))} />
      {(
        [
          ["stability", "Stability", 0, 1, 0.05],
          ["similarity_boost", "Similarity", 0, 1, 0.05],
          ["style", "Style", 0, 1, 0.05],
          ["speed", "Speed", VOICE_SPEED_MIN, VOICE_SPEED_MAX, 0.05],
        ] as const
      ).map(([k, label, min, max, step]) => (
        <Field key={k} label={`${label}: ${value[k].toFixed(2)}`}>
          <Slider value={value[k]} onValueChange={(v) => set(k, v)} min={min} max={max} step={step} />
        </Field>
      ))}
    </div>
  );
}
