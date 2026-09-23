"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { BoxIcon, Share2Icon, Trash2Icon, PencilIcon, RotateCcwIcon, ImagePlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge, Input, Skeleton } from "@/components/ui/primitives";
import { AssetPreview } from "@/components/preview/asset-preview";
import { DownloadPanel } from "@/components/app/download-panel";
import { ShareDialog } from "@/components/app/share-dialog";
import { AssetCard } from "@/components/app/asset-card";
import { api, del, patch, post } from "@/lib/client/api";
import { useInvalidate, type AssetFile, type AssetRow } from "@/hooks/use-data";
import { ASSET_TYPE_LABELS, formatBytes, formatDateTime } from "@/lib/utils";
import type { EnginePreset } from "@/lib/validation/misc";

type Detail = AssetRow & {
  role: string;
  files: AssetFile[];
  derived: AssetRow[];
  project: { id: string; name: string; style_guide: { target_engine?: EnginePreset | null } | null } | null;
  shares: { id: string; allow_download: boolean; expires_at: string | null; view_count: number; created_at: string }[];
};

/** SPEC §17.4 — /app/assets/[id]. */
export default function AssetPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const invalidate = useInvalidate();
  const { data: a, isLoading } = useQuery<Detail>({ queryKey: ["asset", id], queryFn: () => api(`/api/assets/${id}`) });
  const [share, setShare] = React.useState(false);
  const [renaming, setRenaming] = React.useState(false);
  const [name, setName] = React.useState("");
  const [tags, setTags] = React.useState("");

  if (isLoading || !a) return <Skeleton className="h-96" />;
  const meta = a.metadata ?? {};
  const canEdit = ["owner", "admin", "member"].includes(a.role);

  const rename = async () => {
    try {
      await patch(`/api/assets/${id}`, { name: name || a.name, tags: tags.split(",").map((t) => t.trim()).filter(Boolean) });
      setRenaming(false);
      invalidate("asset", "assets");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };
  const remove = async () => {
    if (!confirm("Move this asset to Trash? It can be restored for 14 days.")) return;
    await del(`/api/assets/${id}`);
    invalidate("assets");
    router.push("/app/library");
  };
  const restore = async () => {
    await post(`/api/assets/${id}/restore`);
    invalidate("asset", "assets");
  };
  const revokeShare = async (sid: string) => {
    await del(`/api/share/${sid}`);
    invalidate("asset");
  };

  const rows: [string, React.ReactNode][] = [
    ["Type", ASSET_TYPE_LABELS[a.type]],
    ["Project", a.project ? <Link href={`/app/projects/${a.project.id}`} className="underline">{a.project.name}</Link> : "—"],
    ["Size", formatBytes(a.size_bytes)],
    ["Created", formatDateTime(a.created_at)],
    ...(a.expires_at ? [["Expires", formatDateTime(a.expires_at)] as [string, React.ReactNode]] : []),
    ...(meta.width ? [["Dimensions", `${meta.width} × ${meta.height}`] as [string, React.ReactNode]] : []),
    ...(meta.pixel_grid ? [["Pixel grid", `${meta.pixel_grid} px`] as [string, React.ReactNode]] : []),
    ...(Array.isArray(meta.clips) ? [["Clips", (meta.clips as { name: string; frames: number; fps: number }[]).map((c) => `${c.name} (${c.frames}f @${c.fps})`).join(", ")] as [string, React.ReactNode]] : []),
    ...(meta.tri_count ? [["Triangles", String(meta.tri_count)] as [string, React.ReactNode]] : []),
    ...(meta.has_rig !== undefined ? [["Rig", meta.has_rig ? "yes" : "no"] as [string, React.ReactNode]] : []),
    ...(meta.duration_s ? [["Duration", `${meta.duration_s} s`] as [string, React.ReactNode]] : []),
    ...(Array.isArray(meta.palette) ? [["Palette", <span key="p" className="flex flex-wrap gap-0.5">{(meta.palette as string[]).map((c, i) => <span key={i} className="size-4 rounded-sm border" style={{ background: c }} title={c} />)}</span>] as [string, React.ReactNode]] : []),
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          {renaming ? (
            <div className="flex flex-wrap gap-2">
              <Input value={name} onChange={(e) => setName(e.target.value)} className="w-72" placeholder="Name" />
              <Input value={tags} onChange={(e) => setTags(e.target.value)} className="w-56" placeholder="tags, comma separated" />
              <Button size="sm" onClick={rename}>Save</Button>
              <Button size="sm" variant="ghost" onClick={() => setRenaming(false)}>Cancel</Button>
            </div>
          ) : (
            <h1 className="flex items-center gap-2 text-2xl font-semibold">
              <span className="truncate">{a.name}</span>
              {a.deleted_at && <Badge variant="warning">In Trash</Badge>}
              {canEdit && (
                <Button size="icon-sm" variant="ghost" onClick={() => { setName(a.name); setTags(a.tags.join(", ")); setRenaming(true); }} aria-label="Rename">
                  <PencilIcon />
                </Button>
              )}
            </h1>
          )}
          {a.tags.length > 0 && (
            <div className="mt-1 flex gap-1">
              {a.tags.map((t) => (
                <Badge key={t} variant="secondary">{t}</Badge>
              ))}
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {canEdit && a.type === "image" && (
            <>
              <Button asChild variant="outline" size="sm">
                <Link href={`/app/generate/model_3d?image=${a.id}`}><BoxIcon /> Make 3D from this</Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href={`/app/generate/image?reference=${a.id}`}><ImagePlusIcon /> Use as reference</Link>
              </Button>
            </>
          )}
          {canEdit && a.type === "model_3d" && (
            <Button asChild variant="outline" size="sm">
              <Link href={`/app/generate/model_3d?parent=${a.id}`}>Rig / add animation</Link>
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => setShare(true)}><Share2Icon /> Share</Button>
          {canEdit && (a.deleted_at ? (
            <Button variant="outline" size="sm" onClick={restore}><RotateCcwIcon /> Restore</Button>
          ) : (
            <Button variant="destructive" size="sm" onClick={remove}><Trash2Icon /> Delete</Button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="flex min-h-80 flex-col">
          <AssetPreview asset={a} files={a.files} />
          {a.prompt && (
            <div className="mt-4 rounded-lg border p-3 text-sm">
              <div className="text-muted-foreground mb-1 text-xs">Original prompt</div>
              <p className="whitespace-pre-wrap">{a.prompt}</p>
            </div>
          )}
        </div>
        <div className="flex flex-col gap-4">
          <DownloadPanel assetId={a.id} assetType={a.type} files={a.files} metadata={meta} defaultPreset={a.project?.style_guide?.target_engine ?? "generic"} />
          <dl className="grid grid-cols-[110px_1fr] gap-y-1.5 rounded-lg border p-4 text-sm">
            {rows.map(([k, v]) => (
              <React.Fragment key={k}>
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="min-w-0 break-words">{v}</dd>
              </React.Fragment>
            ))}
          </dl>
          {a.shares.length > 0 && (
            <div className="rounded-lg border p-4 text-sm">
              <div className="mb-2 font-medium">Share links</div>
              <ul className="space-y-1">
                {a.shares.map((s) => (
                  <li key={s.id} className="flex items-center justify-between text-xs">
                    <span>
                      {s.allow_download ? "download" : "view"} · {s.view_count} views{s.expires_at ? ` · until ${formatDateTime(s.expires_at)}` : ""}
                    </span>
                    <Button size="sm" variant="ghost" onClick={() => revokeShare(s.id)}>Revoke</Button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {a.derived.length > 0 && (
        <section>
          <h2 className="mb-2 font-semibold">Derived assets</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {a.derived.map((d) => (
              <AssetCard key={d.id} asset={d} />
            ))}
          </div>
        </section>
      )}
      <ShareDialog open={share} onOpenChange={setShare} target={{ type: "asset", id }} />
    </div>
  );
}
