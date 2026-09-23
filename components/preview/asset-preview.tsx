"use client";

import { ImagePreview } from "./image-preview";
import { SpritePlayer } from "./sprite-player";
import { ModelViewer } from "./model-viewer";
import { AudioPlayer } from "./audio-player";
import { EmptyState } from "@/components/ui/primitives";

export interface PreviewFile {
  id?: string;
  format: string;
  variant: string | null;
  url: string;
}

export interface PreviewAsset {
  type: string;
  name: string;
  metadata: Record<string, unknown>;
  preview_url?: string | null;
  animated_preview_url?: string | null;
}

/** Picks the right viewer for an asset (SPEC §17.4 middle panel / §18 share page). */
export function AssetPreview({ asset, files }: { asset: PreviewAsset; files: PreviewFile[] }) {
  const meta = asset.metadata ?? {};
  const find = (format: string, variant?: string) => files.find((f) => f.format === format && (variant === undefined || f.variant === variant));
  switch (asset.type) {
    case "image": {
      const main = find("png", "main") ?? find("webp") ?? files.find((f) => f.format === "png");
      if (!main) return <Fallback asset={asset} />;
      return <ImagePreview src={main.url} src4x={find("png", "x4")?.url} tileSrc={find("png", "tile3x3")?.url} pixelArt={Boolean(meta.pixel_grid)} alt={asset.name} />;
    }
    case "sprite_animation": {
      const sheet = find("png", "sheet");
      const atlas = find("json_atlas");
      if (sheet && atlas) return <SpritePlayer sheetUrl={sheet.url} atlasUrl={atlas.url} pixelArt={Boolean(meta.pixel_grid)} />;
      return <Fallback asset={asset} />;
    }
    case "model_3d": {
      const glb = find("glb", "main") ?? files.find((f) => f.format === "glb");
      if (!glb) return <Fallback asset={asset} />;
      return <ModelViewer url={glb.url} animations={(meta.animations as string[]) ?? []} textureMaps={(meta.texture_maps as string[]) ?? []} />;
    }
    case "audio_sfx":
    case "audio_music":
    case "audio_voice": {
      const audio = files.filter((f) => ["wav", "mp3", "ogg"].includes(f.format));
      if (!audio.length) return <Fallback asset={asset} />;
      const byVariant = new Map<string, PreviewFile>();
      for (const f of audio) if (!byVariant.has(f.variant ?? "main")) byVariant.set(f.variant ?? "main", f);
      return (
        <div className="flex flex-col gap-3">
          {Array.from(byVariant.entries()).map(([variant, f]) => (
            <div key={variant}>
              {byVariant.size > 1 && <div className="text-muted-foreground mb-1 text-xs">{variant}</div>}
              <AudioPlayer url={f.url} loop={Boolean(meta.loop) || variant === "loop"} compact={byVariant.size > 2} />
            </div>
          ))}
        </div>
      );
    }
    default:
      return <Fallback asset={asset} />;
  }
}

function Fallback({ asset }: { asset: PreviewAsset }) {
  if (asset.preview_url) {
    return (
      <div className="checkerboard flex min-h-64 items-center justify-center rounded-lg border p-4">
        <img src={asset.animated_preview_url ?? asset.preview_url} alt={asset.name} className="max-h-96 object-contain" />
      </div>
    );
  }
  return <EmptyState title="No preview available" />;
}
