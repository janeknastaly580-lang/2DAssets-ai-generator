"use client";

import Link from "next/link";
import { BoxIcon, ImageIcon, MicIcon, MusicIcon, PlayIcon, Volume2Icon } from "lucide-react";
import { Badge, Skeleton } from "@/components/ui/primitives";
import { Checkbox } from "@/components/ui/overlays";
import { cn, ASSET_TYPE_LABELS, relativeTime } from "@/lib/utils";
import type { AssetRow } from "@/hooks/use-data";

export const TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  image: ImageIcon,
  sprite_animation: PlayIcon,
  model_3d: BoxIcon,
  audio_sfx: Volume2Icon,
  audio_music: MusicIcon,
  audio_voice: MicIcon,
};

export function AssetThumb({ asset, className, animated = false }: { asset: Pick<AssetRow, "type" | "preview_url" | "animated_preview_url" | "name" | "metadata">; className?: string; animated?: boolean }) {
  const Icon = TYPE_ICONS[asset.type] ?? ImageIcon;
  const src = animated && asset.animated_preview_url ? asset.animated_preview_url : asset.preview_url;
  const pixel = Boolean((asset.metadata as { pixel_grid?: number })?.pixel_grid);
  return (
    <div className={cn("checkerboard relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-md", className)}>
      {src ? <img src={src} alt={asset.name} className={cn("size-full object-contain", pixel && "pixelated")} loading="lazy" /> : <Icon className="text-muted-foreground size-8" />}
    </div>
  );
}

export function AssetCard({ asset, selected, onSelect, href }: { asset: AssetRow; selected?: boolean; onSelect?: (v: boolean) => void; href?: string }) {
  const Icon = TYPE_ICONS[asset.type] ?? ImageIcon;
  return (
    <div className={cn("bg-card group relative flex flex-col gap-2 rounded-lg border p-2 transition-colors", selected && "border-primary")}>
      {onSelect && (
        <div className="absolute top-3 left-3 z-10">
          <Checkbox checked={selected} onCheckedChange={(v) => onSelect(v === true)} className="bg-background" aria-label="Select asset" />
        </div>
      )}
      <Link href={href ?? `/app/assets/${asset.id}`}>
        <AssetThumb asset={asset} animated />
      </Link>
      <div className="min-w-0 px-1">
        <Link href={href ?? `/app/assets/${asset.id}`} className="block truncate text-sm font-medium hover:underline" title={asset.name}>
          {asset.name}
        </Link>
        <div className="text-muted-foreground flex items-center gap-1.5 text-[11px]">
          <Icon className="size-3" /> {ASSET_TYPE_LABELS[asset.type]} · {relativeTime(asset.created_at)}
          {asset.status !== "ready" && (
            <Badge variant={asset.status === "failed" ? "destructive" : "secondary"} className="ml-auto">
              {asset.status}
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}

export function AssetGridSkeleton({ n = 8 }: { n?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="flex flex-col gap-2 rounded-lg border p-2">
          <Skeleton className="aspect-square w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      ))}
    </div>
  );
}
