"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArchiveIcon, ImagePlusIcon, PencilIcon, Share2Icon, Trash2Icon, UploadIcon, WandIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge, EmptyState, Input, Label, Skeleton } from "@/components/ui/primitives";
import { Select, Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/overlays";
import { AssetCard, AssetGridSkeleton } from "@/components/app/asset-card";
import { ProjectDialog } from "@/components/projects/project-dialog";
import { ShareDialog } from "@/components/app/share-dialog";
import { api, del, post, uploadImage, patch } from "@/lib/client/api";
import { useAssets, useInvalidate, type ProjectRow } from "@/hooks/use-data";
import { ASSET_TYPE_LABELS } from "@/lib/utils";

interface Reference {
  id: string;
  kind: "style" | "character" | "palette";
  label: string | null;
  url: string;
  extracted_palette: string[] | null;
}
type ProjectDetail = ProjectRow & { role: string; references: Reference[] };

/** SPEC §17.4 — /app/projects/[id]: Assets, Style guide, References, Settings tabs. */
export default function ProjectPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const invalidate = useInvalidate();
  const { data: project, isLoading } = useQuery<ProjectDetail>({ queryKey: ["project", id], queryFn: () => api(`/api/projects/${id}`) });
  const [type, setType] = React.useState("all");
  const assets = useAssets({ project: id, type: type === "all" ? undefined : type, limit: "60" });
  const [edit, setEdit] = React.useState(false);
  const [share, setShare] = React.useState(false);
  const [refKind, setRefKind] = React.useState<Reference["kind"]>("style");
  const [refLabel, setRefLabel] = React.useState("");
  const [uploading, setUploading] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);

  if (isLoading || !project) return <Skeleton className="h-64" />;
  const canEdit = ["owner", "admin", "member"].includes(project.role);

  const addReference = async (file: File) => {
    setUploading(true);
    try {
      const up = await uploadImage(file, "reference");
      await post(`/api/projects/${id}/references`, { kind: refKind, label: refLabel || null, upload_id: up.upload_id });
      toast.success("Reference added");
      setRefLabel("");
      invalidate("project");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const removeReference = async (refId: string) => {
    await del(`/api/projects/${id}/references/${refId}`);
    invalidate("project");
  };

  const savePalette = async (refId: string) => {
    try {
      const res = await post<{ palette: string[] }>(`/api/projects/${id}/palette/extract`, { reference_id: refId, colors: 16, save: true });
      toast.success(`Saved ${res.palette.length} colors as project palette`);
      invalidate("project", "projects");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const archive = async () => {
    await patch(`/api/projects/${id}`, { archived: !project.archived_at });
    invalidate("project", "projects");
    toast.success(project.archived_at ? "Project restored" : "Project archived");
  };

  const remove = async () => {
    if (!confirm("Delete this project and all of its assets? This cannot be undone.")) return;
    try {
      await del(`/api/projects/${id}`);
      invalidate("projects");
      router.push("/app/projects");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const sg = project.style_guide ?? {};
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            {project.name}
            {project.is_scratch && <Badge variant="secondary">Scratch</Badge>}
            {project.archived_at && <Badge variant="warning">Archived</Badge>}
          </h1>
          {project.description && <p className="text-muted-foreground text-sm">{project.description}</p>}
        </div>
        <div className="flex gap-2">
          <Button asChild>
            <Link href={`/app/generate/image?project=${id}`}>
              <WandIcon /> Generate
            </Link>
          </Button>
          <Button variant="outline" onClick={() => setShare(true)}>
            <Share2Icon /> Share
          </Button>
        </div>
      </div>

      <Tabs defaultValue="assets">
        <TabsList>
          <TabsTrigger value="assets">Assets</TabsTrigger>
          <TabsTrigger value="style">Style guide</TabsTrigger>
          <TabsTrigger value="references">References</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="assets" className="mt-4">
          <div className="mb-3 flex items-center gap-2">
            <Select
              size="sm"
              className="w-44"
              value={type}
              onValueChange={setType}
              options={[{ value: "all", label: "All types" }, ...Object.entries(ASSET_TYPE_LABELS).map(([v, l]) => ({ value: v, label: l }))]}
            />
          </div>
          {assets.isLoading ? (
            <AssetGridSkeleton />
          ) : assets.data?.items.length ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {assets.data.items.map((a) => (
                <AssetCard key={a.id} asset={a} />
              ))}
            </div>
          ) : (
            <EmptyState title="No assets in this project" action={<Button asChild><Link href={`/app/generate/image?project=${id}`}>Generate the first one</Link></Button>} />
          )}
        </TabsContent>

        <TabsContent value="style" className="mt-4">
          {project.is_scratch ? (
            <p className="text-muted-foreground text-sm">The Scratch project has no style guide. Create a project to define one.</p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              <dl className="grid grid-cols-[120px_1fr] gap-y-2 text-sm">
                <dt className="text-muted-foreground">Art style</dt><dd>{sg.art_style ?? "—"}</dd>
                <dt className="text-muted-foreground">Perspective</dt><dd>{sg.perspective ?? "any"}</dd>
                <dt className="text-muted-foreground">Pixel grid</dt><dd>{sg.pixel_grid ? `${sg.pixel_grid} px` : "—"}</dd>
                <dt className="text-muted-foreground">Mood</dt><dd>{sg.mood ?? "—"}</dd>
                <dt className="text-muted-foreground">Engine</dt><dd>{sg.target_engine ?? "—"}</dd>
                <dt className="text-muted-foreground">Style notes</dt><dd className="whitespace-pre-wrap">{sg.style_notes ?? "—"}</dd>
                <dt className="text-muted-foreground">Audio notes</dt><dd>{sg.audio_notes ?? "—"}</dd>
                <dt className="text-muted-foreground">Palette</dt>
                <dd className="flex flex-wrap gap-1">
                  {sg.palette?.length ? sg.palette.map((c, i) => <span key={i} className="size-5 rounded border" style={{ background: c }} title={c} />) : "—"}
                  {sg.palette_locked && <Badge variant="outline" className="ml-1">locked</Badge>}
                </dd>
              </dl>
              {canEdit && (
                <div>
                  <Button variant="outline" onClick={() => setEdit(true)}>
                    <PencilIcon /> Edit style guide
                  </Button>
                </div>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="references" className="mt-4">
          {canEdit && (
            <div className="mb-4 flex flex-wrap items-end gap-2 rounded-lg border p-3">
              <div className="grid gap-1">
                <Label>Kind</Label>
                <Select size="sm" className="w-36" value={refKind} onValueChange={(v) => setRefKind(v as Reference["kind"])} options={[{ value: "style", label: "Style" }, { value: "character", label: "Character sheet" }, { value: "palette", label: "Palette source" }]} />
              </div>
              <div className="grid gap-1">
                <Label>Label</Label>
                <Input className="h-8 w-48" value={refLabel} onChange={(e) => setRefLabel(e.target.value)} placeholder="Optional" />
              </div>
              <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => e.target.files?.[0] && addReference(e.target.files[0])} />
              <Button size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
                <UploadIcon /> {uploading ? "Uploading…" : "Upload image"}
              </Button>
              <p className="text-muted-foreground w-full text-xs">PNG/JPG/WebP up to 10 MB. Character sheets are used for image-to-image, image-to-3D and animations.</p>
            </div>
          )}
          {project.references.length ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {project.references.map((r) => (
                <div key={r.id} className="bg-card group relative rounded-lg border p-2">
                  <div className="checkerboard aspect-square overflow-hidden rounded">
                    <img src={r.url} alt={r.label ?? r.kind} className="size-full object-contain" />
                  </div>
                  <div className="mt-1 flex items-center justify-between text-xs">
                    <span className="truncate">{r.label ?? r.kind}</span>
                    <Badge variant="outline">{r.kind}</Badge>
                  </div>
                  {r.extracted_palette?.length ? (
                    <div className="mt-1 flex gap-0.5">
                      {r.extracted_palette.slice(0, 12).map((c, i) => (
                        <span key={i} className="size-3 rounded-sm" style={{ background: c }} />
                      ))}
                    </div>
                  ) : null}
                  {canEdit && (
                    <div className="mt-2 flex gap-1">
                      {r.kind === "palette" && !project.is_scratch && (
                        <Button size="sm" variant="outline" className="h-7 flex-1 text-xs" onClick={() => savePalette(r.id)}>
                          <ImagePlusIcon /> Save as palette
                        </Button>
                      )}
                      <Button size="icon-sm" variant="ghost" onClick={() => removeReference(r.id)} aria-label="Remove">
                        <XIcon />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="No references" description="Upload style references, character sheets or palette sources." />
          )}
        </TabsContent>

        <TabsContent value="settings" className="mt-4">
          <div className="flex flex-col gap-3">
            {canEdit && !project.is_scratch && (
              <>
                <Button variant="outline" className="w-fit" onClick={() => setEdit(true)}>
                  <PencilIcon /> Rename / edit
                </Button>
                <Button variant="outline" className="w-fit" onClick={archive}>
                  <ArchiveIcon /> {project.archived_at ? "Restore project" : "Archive project"}
                </Button>
                <Button variant="destructive" className="w-fit" onClick={remove}>
                  <Trash2Icon /> Delete project
                </Button>
              </>
            )}
            {project.is_scratch && <p className="text-muted-foreground text-sm">The Scratch project cannot be renamed, archived or deleted.</p>}
          </div>
        </TabsContent>
      </Tabs>

      <ProjectDialog open={edit} onOpenChange={setEdit} project={project} />
      <ShareDialog open={share} onOpenChange={setShare} target={{ type: "project", id }} />
    </div>
  );
}
