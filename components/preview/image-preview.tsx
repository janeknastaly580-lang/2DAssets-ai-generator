"use client";

import * as React from "react";
import { ZoomInIcon, ZoomOutIcon, Grid3x3Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** SPEC §17.4 ImagePreview — zoom, checkerboard alpha, 1×/4× for pixel art, 3×3 for seamless. */
export function ImagePreview({ src, src4x, tileSrc, pixelArt, alt, className }: { src: string; src4x?: string | null; tileSrc?: string | null; pixelArt?: boolean; alt?: string; className?: string }) {
  const [zoom, setZoom] = React.useState(1);
  const [mode, setMode] = React.useState<"1x" | "4x" | "tile">(pixelArt && src4x ? "4x" : "1x");
  const current = mode === "tile" && tileSrc ? tileSrc : mode === "4x" && src4x ? src4x : src;
  return (
    <div className={cn("flex flex-col", className)}>
      <div className="checkerboard relative flex min-h-64 flex-1 items-center justify-center overflow-auto rounded-lg border">
        <img src={current} alt={alt ?? ""} className={cn("max-h-full max-w-full object-contain transition-transform", pixelArt && "pixelated")} style={{ transform: `scale(${zoom})` }} />
      </div>
      <div className="mt-2 flex items-center gap-1">
        <Button variant="outline" size="icon-sm" onClick={() => setZoom((z) => Math.max(0.25, z / 1.5))} aria-label="Zoom out">
          <ZoomOutIcon />
        </Button>
        <span className="text-muted-foreground w-12 text-center text-xs">{Math.round(zoom * 100)}%</span>
        <Button variant="outline" size="icon-sm" onClick={() => setZoom((z) => Math.min(8, z * 1.5))} aria-label="Zoom in">
          <ZoomInIcon />
        </Button>
        <div className="ml-auto flex gap-1">
          {pixelArt && src4x && (
            <>
              <Button variant={mode === "1x" ? "secondary" : "ghost"} size="sm" onClick={() => setMode("1x")}>1×</Button>
              <Button variant={mode === "4x" ? "secondary" : "ghost"} size="sm" onClick={() => setMode("4x")}>4×</Button>
            </>
          )}
          {tileSrc && (
            <Button variant={mode === "tile" ? "secondary" : "ghost"} size="sm" onClick={() => setMode(mode === "tile" ? "1x" : "tile")}>
              <Grid3x3Icon /> 3×3
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
