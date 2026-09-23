"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { PackageIcon, Trash2Icon, FolderInputIcon, RotateCcwIcon, SearchIcon, Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, Input } from "@/components/ui/primitives";
import { Select, Tabs, TabsList, TabsTrigger } from "@/components/ui/overlays";
import { AssetCard, AssetGridSkeleton } from "@/components/app/asset-card";
import { api, del, patch, post } from "@/lib/client/api";
import { useAssets, useInvalidate, useProjects } from "@/hooks/use-data";
import { ASSET_TYPE_LABELS } from "@/lib/utils";
import { ENGINE_PRESETS } from "@/lib/validation/misc";

function LibraryInner() {
  const sp = useSearchParams();
  const invalidate = useInvalidate();
  const { data: projects } = useProjects();
  const [q, setQ] = React.useState("");
  const [debounced, setDebounced] = React.useState("");
  const [type, setType] = React.useState("all");
  const [project, setProject] = React.useState("all");
  const [view, setView] = React.useState<"all" | "trash">("all");
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [preset, setPreset] = React.useState("generic");
  const [moveTo, setMoveTo] = React.useState("");
  const [zipping, setZipping] = React.useState(false);
  const searchRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(q), 300);
    return () => clearTimeout(t);
  }, [q]);
  React.useEffect(() => {
    if (sp.get("focus") === "search") searchRef.current?.focus();
  }, [sp]);

  const assets = useAssets({ q: debounced || undefined, type: type === "all" ? undefined : type, project: project === "all" ? undefined : project, trash: view === "trash" ? "1" : undefined, limit: "60" });
  const items = assets.data?.items ?? [];
  const toggle = (id: string, v: boolean) => setSelected((s) => {
    const n = new Set(s);
    if (v) n.add(id);
    else n.delete(id);
    return n;
  });
  const ids = Array.from(selected);

  const bulkDelete = async () => {
    if (!ids.length || !confirm(`Move ${ids.length} assets to Trash?`)) return;
    await Promise.all(ids.map((id) => del(`/api/assets/${id}`)));
    setSelected(new Set());
    invalidate("assets");
  };
  const bulkRestore = async () => {
    await Promise.all(ids.map((id) => post(`/api/assets/${id}/restore`)));
    setSelected(new Set());
    invalidate("assets");
  };
  const bulkMove = async () => {
    if (!moveTo) return;
    await Promise.all(ids.map((id) => patch(`/api/assets/${id}`, { project_id: moveTo })));
    toast.success("Moved");
    setSelected(new Set());
    invalidate("assets");
  };
  const bulkZip = async () => {
    setZipping(true);
    try {
      const dl = await post<{ id: string }>("/api/downloads", { asset_ids: ids, engine_preset: preset });
      for (let i = 0; i < 90; i++) {
        await new Promise((r) => setTimeout(r, 1500));
        const st = await api<{ status: string; url: string | null; error: string | null }>(`/api/downloads/${dl.id}`);
        if (st.status === "ready" && st.url) {
          window.location.href = st.url;
          return;
        }
        if (st.status === "failed") throw new Error(st.error ?? "ZIP failed");
      }
      toast.info("Still building — check back in a minute.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setZipping(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-semibold">Library</h1>
        <Tabs value={view} onValueChange={(v) => { setView(v as "all" | "trash"); setSelected(new Set()); }} className="ml-2">
          <TabsList>
            <TabsTrigger value="all">Assets</TabsTrigger>
            <TabsTrigger value="trash">Trash</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <SearchIcon className="text-muted-foreground absolute top-2.5 left-2.5 size-4" />
          <Input ref={searchRef} className="w-64 pl-8" placeholder="Search name or prompt…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Select size="sm" className="w-40" value={type} onValueChange={setType} options={[{ value: "all", label: "All types" }, ...Object.entries(ASSET_TYPE_LABELS).map(([v, l]) => ({ value: v, label: l }))]} />
        <Select size="sm" className="w-48" value={project} onValueChange={setProject} options={[{ value: "all", label: "All projects" }, ...(projects ?? []).map((p) => ({ value: p.id, label: p.name }))]} />
        {ids.length > 0 && (
          <div className="ml-auto flex flex-wrap items-center gap-2 rounded-lg border p-1.5 text-sm">
            <span className="text-muted-foreground px-1">{ids.length} selected</span>
            {view === "all" ? (
              <>
                <Select size="sm" className="w-32" value={preset} onValueChange={setPreset} options={ENGINE_PRESETS.map((p) => ({ value: p, label: p }))} />
                <Button size="sm" variant="outline" onClick={bulkZip} disabled={zipping}>
                  {zipping ? <Loader2Icon className="animate-spin" /> : <PackageIcon />} Download ZIP
                </Button>
                <Select size="sm" className="w-40" value={moveTo} onValueChange={setMoveTo} placeholder="Move to project…" options={(projects ?? []).map((p) => ({ value: p.id, label: p.name }))} />
                <Button size="sm" variant="outline" onClick={bulkMove} disabled={!moveTo}>
                  <FolderInputIcon /> Move
                </Button>
                <Button size="sm" variant="destructive" onClick={bulkDelete}>
                  <Trash2Icon /> Delete
                </Button>
              </>
            ) : (
              <Button size="sm" variant="outline" onClick={bulkRestore}>
                <RotateCcwIcon /> Restore
              </Button>
            )}
          </div>
        )}
      </div>
      {assets.isLoading ? (
        <AssetGridSkeleton n={10} />
      ) : items.length ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {items.map((a) => (
            <AssetCard key={a.id} asset={a} selected={selected.has(a.id)} onSelect={(v) => toggle(a.id, v)} />
          ))}
        </div>
      ) : (
        <EmptyState title={view === "trash" ? "Trash is empty" : "No assets found"} description={view === "trash" ? "Deleted assets stay here for 14 days." : "Try another filter or generate something new."} />
      )}
    </div>
  );
}

export default function LibraryPage() {
  return (
    <React.Suspense>
      <LibraryInner />
    </React.Suspense>
  );
}
