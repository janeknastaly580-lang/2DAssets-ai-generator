"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { CoinsIcon, Loader2Icon, WandIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge, Skeleton } from "@/components/ui/primitives";
import { Select, Tooltip } from "@/components/ui/overlays";
import { AssetPreview } from "@/components/preview/asset-preview";
import { AssetThumb } from "@/components/app/asset-card";
import { JobStatusBadge } from "@/components/app/job-status";
import { api, post, ApiClientError } from "@/lib/client/api";
import { track } from "@/lib/analytics";
import { useAssets, useCreateJob, useProjects, useInvalidate, type AssetFile, type AssetRow, type JobRow } from "@/hooks/use-data";
import { useJobFeed } from "@/hooks/use-job-feed";
import { ASSET_TYPE_LABELS, relativeTime } from "@/lib/utils";
import type { PlanTier } from "@/lib/plans";
import type { StyleGuide } from "@/lib/validation/project";
import { Model3dForm, defaultModel3dForm, type Model3dFormValue } from "./forms-visual";
import { SfxForm, MusicForm, VoiceForm, defaultSfxForm, defaultMusicForm, defaultVoiceForm, type SfxFormValue, type MusicFormValue, type VoiceFormValue } from "./forms-audio";

export interface GeneratorProps {
  type: string;
  plan: PlanTier;
  canGenerate: boolean;
  disabledReason?: string;
  initialProjectId: string | null;
  balance: number;
}

type FormValue = Model3dFormValue | SfxFormValue | MusicFormValue | VoiceFormValue;

interface Estimate {
  credits: number;
  lines: { label: string; qty: number; total: number }[];
  balance: number;
  enough: boolean;
}

interface ProjectDetail {
  id: string;
  style_guide: StyleGuide;
  is_scratch: boolean;
  references: { id: string; kind: string; label: string | null; url: string }[];
}

function defaultsFor(type: string, sg: StyleGuide | null): FormValue {
  switch (type) {
    case "model_3d":
      return defaultModel3dForm();
    case "audio_sfx":
      return defaultSfxForm();
    case "audio_music":
      return defaultMusicForm(sg);
    default:
      return defaultVoiceForm(sg);
  }
}

/** Maps UI form state to the API input (SPEC §9 schemas). */
function toInput(type: string, v: FormValue): Record<string, unknown> {
  switch (type) {
    case "model_3d": {
      const f = v as Model3dFormValue;
      return { ...f, images: f.images.map((i) => ({ kind: i.kind, id: i.id })) };
    }
    default:
      return { ...(v as object) };
  }
}

function isReady(type: string, v: FormValue): boolean {
  switch (type) {
    case "model_3d": {
      const f = v as Model3dFormValue;
      if (f.engine === "trellis") return f.images.length === 1; // TRELLIS is photo-only (SPEC §9.7)
      return f.prompt.trim().length > 0 || f.images.length > 0;
    }
    case "audio_voice":
      return (v as VoiceFormValue).text.trim().length > 0 && (v as VoiceFormValue).instructions.trim().length > 0;
    default:
      return ((v as SfxFormValue).prompt ?? "").trim().length > 0;
  }
}

export function Generator({ type, plan, canGenerate, disabledReason, initialProjectId, balance: initialBalance }: GeneratorProps) {
  const router = useRouter();
  const sp = useSearchParams();
  const invalidate = useInvalidate();
  const { data: projects } = useProjects();
  const [projectId, setProjectId] = React.useState<string | null>(initialProjectId);
  const { data: project } = useQuery<ProjectDetail>({ queryKey: ["project", projectId], queryFn: () => api(`/api/projects/${projectId}`), enabled: Boolean(projectId) });
  const sg = project && !project.is_scratch ? project.style_guide : null;
  const [value, setValue] = React.useState<FormValue>(() => defaultsFor(type, null));
  const [selected, setSelected] = React.useState<string | null>(null);
  const [estimate, setEstimate] = React.useState<Estimate | null>(null);
  const create = useCreateJob();
  const feed = useJobFeed(projects?.[0]?.workspace_id ?? "");
  const jobs = useQuery<JobRow[]>({ queryKey: ["jobs", `type=${type}&project=${projectId}`], queryFn: () => api(`/api/jobs?type=${type}&project=${projectId}&limit=30`), enabled: Boolean(projectId), refetchInterval: feed.active.length ? 3000 : false });
  const results = useAssets({ type, project: projectId ?? undefined, limit: "30" });

  // pick Scratch when no project chosen
  React.useEffect(() => {
    if (!projectId && projects?.length) setProjectId(projects.find((p) => p.is_scratch)?.id ?? projects[0].id);
  }, [projects, projectId]);

  // apply style guide defaults & URL prefills once project loads
  const initialised = React.useRef(false);
  React.useEffect(() => {
    if (!project || initialised.current) return;
    initialised.current = true;
    const base = defaultsFor(type, sg);
    const image = sp.get("image");
    const parent = sp.get("parent");
    const retry = sp.get("retry");
    if (type === "model_3d" && image) (base as Model3dFormValue).images = [{ kind: "asset", id: image, label: "Library asset" }];
    if (type === "model_3d" && parent) (base as Model3dFormValue).parent_asset_id = parent;
    setValue(base);
    if (retry) {
      api<JobRow>(`/api/jobs/${retry}`).then((j) => {
        setValue((prev) => ({ ...prev, ...(j.input as object) }) as FormValue);
        toast.info("Loaded parameters from the previous job");
      }).catch(() => undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project]);

  // cost estimate (debounced)
  const ready = isReady(type, value);
  React.useEffect(() => {
    if (!ready) {
      setEstimate(null);
      return;
    }
    const t = setTimeout(() => {
      post<Estimate>("/api/jobs/estimate", { type, input: toInput(type, value) })
        .then(setEstimate)
        .catch((e) => {
          setEstimate(null);
          if (e instanceof ApiClientError && e.code !== "validation_error") toast.error(e.message);
        });
    }, 400);
    return () => clearTimeout(t);
  }, [type, value, ready]);

  const submit = async () => {
    if (!projectId) return;
    try {
      const res = await create.mutateAsync({ type, project_id: projectId, input: toInput(type, value) });
      toast.success(`Job started · ${res.estimate.credits} credits reserved`);
      track("generate_asset", { asset_type: type, credits: res.estimate.credits });
      invalidate("jobs", "balance");
      router.refresh();
    } catch (e) {
      const err = e as ApiClientError;
      if (err.code === "insufficient_credits") toast.error(err.message, { action: { label: "Buy credits", onClick: () => router.push("/app/billing") } });
      else toast.error(err.message);
    }
  };

  const cancelJob = async (id: string) => {
    await post(`/api/jobs/${id}/cancel`);
    invalidate("jobs", "balance");
  };

  // preview: the selected result or the newest one
  const items = results.data?.items ?? [];
  const current = items.find((a) => a.id === selected) ?? items[0] ?? null;
  const detail = useQuery<AssetRow & { files: AssetFile[] }>({ queryKey: ["asset", current?.id], queryFn: () => api(`/api/assets/${current!.id}`), enabled: Boolean(current) });
  const activeJobs = (jobs.data ?? []).filter((j) => !["completed", "failed", "rejected", "cancelled"].includes(j.status));
  const recentJobs = (jobs.data ?? []).filter((j) => ["failed", "rejected", "cancelled"].includes(j.status)).slice(0, 5);
  const balance = estimate?.balance ?? initialBalance;
  const disabled = !canGenerate || !ready || !projectId || create.isPending || (estimate ? !estimate.enough : false);
  const reason = !canGenerate ? disabledReason : !ready ? "Fill in the required fields" : estimate && !estimate.enough ? "Not enough credits" : undefined;

  const references = project?.references ?? [];

  return (
    <div className="grid gap-4 lg:grid-cols-[360px_1fr_300px]">
      {/* left — parameters */}
      <div className="flex flex-col gap-4 rounded-lg border p-4">
        <div className="grid gap-1.5">
          <span className="text-xs font-medium">Project</span>
          <Select size="sm" value={projectId ?? ""} onValueChange={(v) => { setProjectId(v); initialised.current = false; }} options={(projects ?? []).map((p) => ({ value: p.id, label: p.is_scratch ? "Scratch (no style guide)" : p.name }))} placeholder="Choose a project" />
          {sg && (
            <div className="text-muted-foreground flex flex-wrap gap-1 text-[11px]">
              {sg.art_style && <Badge variant="outline">{sg.art_style}</Badge>}
              {sg.perspective && <Badge variant="outline">{sg.perspective}</Badge>}
              {sg.palette_locked && <Badge variant="outline">palette locked</Badge>}
            </div>
          )}
        </div>
        {type === "model_3d" && <Model3dForm value={value as Model3dFormValue} onChange={setValue} styleGuide={sg} references={references} plan={plan} />}
        {type === "audio_sfx" && <SfxForm value={value as SfxFormValue} onChange={setValue} />}
        {type === "audio_music" && <MusicForm value={value as MusicFormValue} onChange={setValue} />}
        {type === "audio_voice" && <VoiceForm value={value as VoiceFormValue} onChange={setValue} />}

        <div className="bg-muted/40 rounded-md border p-3 text-xs">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1"><CoinsIcon className="size-3.5" /> Cost</span>
            <span className="font-medium">{estimate ? `${estimate.credits} credits` : "—"}</span>
          </div>
          <div className="text-muted-foreground mt-1 flex items-center justify-between">
            <span>Balance</span>
            <span>{balance} credits</span>
          </div>
          {estimate?.lines.map((l) => (
            <div key={l.label} className="text-muted-foreground mt-0.5 flex justify-between">
              <span className="truncate">{l.label} × {l.qty}</span>
              <span>{l.total}</span>
            </div>
          ))}
        </div>
        <Tooltip content={reason}>
          <span>
            <Button className="w-full" onClick={submit} disabled={disabled}>
              {create.isPending ? <Loader2Icon className="animate-spin" /> : <WandIcon />} Generate{estimate ? ` (${estimate.credits})` : ""}
            </Button>
          </span>
        </Tooltip>
        {estimate && !estimate.enough && (
          <Link href="/app/billing" className="text-primary text-center text-xs underline">Buy credits</Link>
        )}
      </div>

      {/* middle — preview */}
      <div className="flex min-h-[420px] flex-col gap-3 rounded-lg border p-4">
        {activeJobs.length > 0 && (
          <div className="flex flex-col gap-2">
            {activeJobs.map((j) => {
              const live = feed.get(j.id);
              return (
                <div key={j.id} className="flex items-center justify-between rounded-md border p-2 text-sm">
                  <JobStatusBadge status={live?.status ?? j.status} progress={live?.progress ?? j.progress} />
                  <span className="text-muted-foreground text-xs">{relativeTime(j.created_at)}</span>
                  <Button size="sm" variant="ghost" onClick={() => cancelJob(j.id)}><XIcon /> Cancel</Button>
                </div>
              );
            })}
          </div>
        )}
        {recentJobs.map((j) => (
          <div key={j.id} className="border-destructive/40 text-destructive rounded-md border p-2 text-xs">
            <JobStatusBadge status={j.status} /> <span className="ml-2">{j.error_message}</span>
          </div>
        ))}
        {current ? (
          detail.data ? (
            <>
              <div className="flex items-center justify-between">
                <Link href={`/app/assets/${current.id}`} className="truncate font-medium hover:underline">{current.name}</Link>
                <Button asChild size="sm" variant="outline"><Link href={`/app/assets/${current.id}`}>Open & download</Link></Button>
              </div>
              <div className="min-h-72">
                <AssetPreview asset={detail.data} files={detail.data.files} />
              </div>
            </>
          ) : (
            <Skeleton className="min-h-72 flex-1" />
          )
        ) : (
          <div className="text-muted-foreground flex flex-1 items-center justify-center text-sm">
            {activeJobs.length ? "Generating…" : `Your generated ${ASSET_TYPE_LABELS[type]?.toLowerCase()} will appear here.`}
          </div>
        )}
      </div>

      {/* right — results */}
      <div className="flex flex-col gap-2 rounded-lg border p-3">
        <div className="text-xs font-medium">Results in this project</div>
        {results.isLoading && <Skeleton className="h-24" />}
        {items.length === 0 && !results.isLoading && <p className="text-muted-foreground text-xs">Nothing yet.</p>}
        <div className="grid grid-cols-2 gap-2 overflow-y-auto lg:grid-cols-1">
          {items.map((a) => (
            <button key={a.id} type="button" onClick={() => setSelected(a.id)} className={`flex items-center gap-2 rounded-md border p-1.5 text-left text-xs hover:bg-accent cursor-pointer ${current?.id === a.id ? "border-primary" : ""}`}>
              <AssetThumb asset={a} className="size-12 shrink-0" />
              <span className="min-w-0 flex-1">
                <span className="block truncate">{a.name}</span>
                <span className="text-muted-foreground block">{relativeTime(a.created_at)}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
