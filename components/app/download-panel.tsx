"use client";

import * as React from "react";
import { DownloadIcon, PackageIcon, Loader2Icon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/primitives";
import { Select } from "@/components/ui/overlays";
import { api, post } from "@/lib/client/api";
import { formatBytes } from "@/lib/utils";
import { fileMatchesPreset, readmeFor } from "@/lib/postprocess/enginePresets";
import { ENGINE_PRESETS, type EnginePreset } from "@/lib/validation/misc";
import type { AssetFile } from "@/hooks/use-data";

const PRESET_LABELS: Record<EnginePreset, string> = { unity: "Unity", unreal: "Unreal", godot: "Godot", generic: "Generic (all files)" };

/** SPEC §17.4 DownloadPanel — preset picker, file list with sizes, ZIP with README. */
export function DownloadPanel({ assetId, assetType, files, metadata, defaultPreset = "generic" }: { assetId: string; assetType: string; files: AssetFile[]; metadata: Record<string, unknown>; defaultPreset?: EnginePreset | null }) {
  const [preset, setPreset] = React.useState<EnginePreset>(defaultPreset ?? "generic");
  const [zipState, setZipState] = React.useState<"idle" | "building" | "ready">("idle");
  const visible = files.filter((f) => fileMatchesPreset(f, preset, assetType));
  const readme = readmeFor(preset, assetType, metadata);

  const downloadFile = async (fileId: string) => {
    try {
      const res = await api<{ url: string }>(`/api/assets/${assetId}/download?file=${fileId}`);
      window.location.href = res.url;
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const downloadZip = async () => {
    setZipState("building");
    try {
      const dl = await post<{ id: string }>("/api/downloads", { asset_ids: [assetId], engine_preset: preset });
      for (let i = 0; i < 60; i++) {
        await new Promise((r) => setTimeout(r, 1500));
        const st = await api<{ status: string; url: string | null; error: string | null }>(`/api/downloads/${dl.id}`);
        if (st.status === "ready" && st.url) {
          window.location.href = st.url;
          setZipState("ready");
          return;
        }
        if (st.status === "failed") throw new Error(st.error ?? "ZIP failed");
      }
      throw new Error("ZIP is taking longer than expected — check the Downloads list later");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setZipState("idle");
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-lg border p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-medium">Download</h3>
        <Select size="sm" className="w-44" value={preset} onValueChange={(v) => setPreset(v as EnginePreset)} options={ENGINE_PRESETS.map((p) => ({ value: p, label: PRESET_LABELS[p] }))} />
      </div>
      <ul className="divide-y text-sm">
        {visible.map((f) => (
          <li key={f.id} className="flex items-center gap-2 py-1.5">
            <Badge variant="outline" className="w-16 justify-center uppercase">{f.ext}</Badge>
            <span className="flex-1 truncate">{f.variant ?? f.format}</span>
            <span className="text-muted-foreground text-xs">{formatBytes(f.size_bytes)}</span>
            <Button size="icon-sm" variant="ghost" onClick={() => downloadFile(f.id)} aria-label="Download file">
              <DownloadIcon />
            </Button>
          </li>
        ))}
        {!visible.length && <li className="text-muted-foreground py-2 text-xs">No files match this preset.</li>}
      </ul>
      {readme && <p className="text-muted-foreground text-xs">ZIP includes {readme.name} with import steps.</p>}
      <Button onClick={downloadZip} disabled={zipState === "building" || !visible.length}>
        {zipState === "building" ? <Loader2Icon className="animate-spin" /> : <PackageIcon />} Download ZIP ({PRESET_LABELS[preset]})
      </Button>
    </div>
  );
}
