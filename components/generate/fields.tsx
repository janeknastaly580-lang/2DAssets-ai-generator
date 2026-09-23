"use client";

import * as React from "react";
import { UploadIcon, XIcon } from "lucide-react";
import { toast } from "sonner";
import { Input, Label, Textarea } from "@/components/ui/primitives";
import { Select, Switch, Tooltip } from "@/components/ui/overlays";
import { Button } from "@/components/ui/button";
import { uploadImage } from "@/lib/client/api";
import { cn } from "@/lib/utils";

export function Field({ label, hint, children, className }: { label: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("grid gap-1.5", className)}>
      <Label className="text-xs">{label}</Label>
      {children}
      {hint && <p className="text-muted-foreground text-[11px]">{hint}</p>}
    </div>
  );
}

export function ToggleRow({ label, hint, checked, onCheckedChange, disabled }: { label: string; hint?: string; checked: boolean; onCheckedChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <label className="flex items-center justify-between gap-3 text-sm">
      <span>
        <span className="text-xs font-medium">{label}</span>
        {hint && <span className="text-muted-foreground block text-[11px]">{hint}</span>}
      </span>
      <Switch checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} />
    </label>
  );
}

export function PromptField({ value, onChange, max = 1500, placeholder, rows = 4, label = "Prompt" }: { value: string; onChange: (v: string) => void; max?: number; placeholder?: string; rows?: number; label?: string }) {
  return (
    <Field label={label}>
      <Textarea value={value} onChange={(e) => onChange(e.target.value.slice(0, max))} placeholder={placeholder} rows={rows} className="min-h-24" />
      <div className="text-muted-foreground text-right text-[11px]">
        {value.length} / {max}
      </div>
    </Field>
  );
}

export function SelectField<T extends string>({ label, value, onChange, options, hint }: { label: string; value: T; onChange: (v: T) => void; options: { value: T; label: string; disabled?: boolean }[]; hint?: string }) {
  return (
    <Field label={label} hint={hint}>
      <Select size="sm" value={value} onValueChange={(v) => onChange(v as T)} options={options} />
    </Field>
  );
}

export function NumberField({ label, value, onChange, min, max, step = 1, hint }: { label: string; value: number | null | undefined; onChange: (v: number | null) => void; min?: number; max?: number; step?: number; hint?: string }) {
  return (
    <Field label={label} hint={hint}>
      <Input type="number" className="h-8" value={value ?? ""} min={min} max={max} step={step} onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))} />
    </Field>
  );
}

export type ImageRef = { kind: "reference" | "asset" | "upload"; id: string; label?: string; url?: string };

/**
 * SPEC §17.5 / §9.3 — up to `max` input photos (project references or uploads).
 * `max` comes from the workspace plan (PLANS[plan].maxInputImages).
 */
export function MultiReferencePicker({
  label,
  values,
  onChange,
  references,
  max,
  hint,
  limitNote,
}: {
  label: string;
  values: ImageRef[];
  onChange: (v: ImageRef[]) => void;
  references: { id: string; kind: string; label: string | null; url: string }[];
  max: number;
  hint?: string;
  /** shown instead of the plan upsell when the limit comes from elsewhere (e.g. TRELLIS takes one photo) */
  limitNote?: string;
}) {
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [busy, setBusy] = React.useState(false);
  const full = values.length >= max;

  const add = (ref: ImageRef) => {
    if (values.some((v) => v.id === ref.id)) return;
    if (values.length >= max) {
      toast.error(limitNote ?? `You can attach up to ${max} photo${max === 1 ? "" : "s"} on this plan`);
      return;
    }
    onChange([...values, ref]);
  };
  const uploadFiles = async (files: FileList) => {
    setBusy(true);
    try {
      const room = max - values.length;
      if (files.length > room) toast.error(`Only ${room} more photo${room === 1 ? "" : "s"} can be attached`);
      const picked = Array.from(files).slice(0, room);
      const added: ImageRef[] = [];
      for (const file of picked) {
        const up = await uploadImage(file, "image_input");
        added.push({ kind: "upload", id: up.upload_id, label: file.name, url: up.url });
      }
      if (added.length) onChange([...values, ...added]);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Field label={label} hint={hint}>
      {values.length > 0 && (
        <div className="mb-1.5 flex flex-wrap gap-1.5">
          {values.map((v) => (
            <div key={v.id} className="relative">
              <div className="checkerboard size-14 overflow-hidden rounded border">
                {v.url && <img src={v.url} alt={v.label ?? ""} className="size-full object-contain" />}
              </div>
              <Button
                size="icon-sm"
                variant="secondary"
                className="absolute -top-1.5 -right-1.5 size-5 rounded-full border"
                onClick={() => onChange(values.filter((x) => x.id !== v.id))}
                aria-label={`Remove ${v.label ?? "photo"}`}
              >
                <XIcon className="size-3" />
              </Button>
            </div>
          ))}
        </div>
      )}
      <div className="flex flex-wrap gap-1.5">
        {references
          .filter((r) => !values.some((v) => v.id === r.id))
          .map((r) => (
            <Tooltip key={r.id} content={`${r.kind}: ${r.label ?? ""}`}>
              <button
                type="button"
                disabled={full}
                onClick={() => add({ kind: "reference", id: r.id, label: r.label ?? r.kind, url: r.url })}
                className="checkerboard size-12 overflow-hidden rounded border hover:ring-2 hover:ring-primary cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
              >
                <img src={r.url} alt={r.label ?? r.kind} className="size-full object-contain" />
              </button>
            </Tooltip>
          ))}
        <input
          ref={fileRef}
          type="file"
          multiple={max > 1}
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(e) => e.target.files?.length && uploadFiles(e.target.files)}
        />
        <Button type="button" size="sm" variant="outline" className="h-12" onClick={() => fileRef.current?.click()} disabled={busy || full}>
          <UploadIcon /> {busy ? "Uploading…" : "Upload"}
        </Button>
      </div>
      <p className="text-muted-foreground text-[11px]">
        {values.length} / {max} photo{max === 1 ? "" : "s"}
        {limitNote ? ` — ${limitNote}` : max === 1 ? " — the Pro and Studio plans allow 3" : ""}
      </p>
    </Field>
  );
}

/** SPEC §17.5 ReferencePicker — project references, library asset or upload. */
export function ReferencePicker({ label, value, onChange, references, hint }: { label: string; value: ImageRef | null; onChange: (v: ImageRef | null) => void; references: { id: string; kind: string; label: string | null; url: string }[]; hint?: string }) {
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [busy, setBusy] = React.useState(false);
  const upload = async (file: File) => {
    setBusy(true);
    try {
      const up = await uploadImage(file, "image_input");
      onChange({ kind: "upload", id: up.upload_id, label: file.name, url: up.url });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Field label={label} hint={hint}>
      {value ? (
        <div className="flex items-center gap-2 rounded-md border p-1.5 text-xs">
          {value.url && <img src={value.url} alt="" className="checkerboard size-10 rounded object-contain" />}
          <span className="flex-1 truncate">{value.label ?? `${value.kind}: ${value.id.slice(0, 8)}…`}</span>
          <Button size="icon-sm" variant="ghost" onClick={() => onChange(null)} aria-label="Clear">
            <XIcon />
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {references.map((r) => (
            <Tooltip key={r.id} content={`${r.kind}: ${r.label ?? ""}`}>
              <button type="button" onClick={() => onChange({ kind: "reference", id: r.id, label: r.label ?? r.kind, url: r.url })} className="checkerboard size-12 overflow-hidden rounded border hover:ring-2 hover:ring-primary cursor-pointer">
                <img src={r.url} alt={r.label ?? r.kind} className="size-full object-contain" />
              </button>
            </Tooltip>
          ))}
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
          <Button type="button" size="sm" variant="outline" className="h-12" onClick={() => fileRef.current?.click()} disabled={busy}>
            <UploadIcon /> {busy ? "Uploading…" : "Upload"}
          </Button>
        </div>
      )}
    </Field>
  );
}
