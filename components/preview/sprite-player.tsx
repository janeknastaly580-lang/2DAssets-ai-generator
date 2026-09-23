"use client";

import * as React from "react";
import { PauseIcon, PlayIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, Slider } from "@/components/ui/overlays";

export interface AtlasJson {
  frames: Record<string, { frame: { x: number; y: number; w: number; h: number } }>;
  animations: Record<string, string[]>;
  fps: Record<string, number>;
  meta: { size: { w: number; h: number } };
}

/** SPEC §17.4 SpriteSheetPlayer — canvas playback of atlas clips, fps slider, direction toggle. */
export function SpritePlayer({ sheetUrl, atlasUrl, pixelArt }: { sheetUrl: string; atlasUrl: string; pixelArt?: boolean }) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const [atlas, setAtlas] = React.useState<AtlasJson | null>(null);
  const [img, setImg] = React.useState<HTMLImageElement | null>(null);
  const [clip, setClip] = React.useState<string>("");
  const [fps, setFps] = React.useState(12);
  const [playing, setPlaying] = React.useState(true);
  const [frame, setFrame] = React.useState(0);
  const [flip, setFlip] = React.useState(false);

  React.useEffect(() => {
    let alive = true;
    fetch(atlasUrl)
      .then((r) => r.json())
      .then((a: AtlasJson) => {
        if (!alive) return;
        setAtlas(a);
        const first = Object.keys(a.animations)[0] ?? "";
        setClip(first);
        setFps(a.fps?.[first] ?? 12);
      })
      .catch(() => undefined);
    const i = new Image();
    i.crossOrigin = "anonymous";
    i.onload = () => alive && setImg(i);
    i.src = sheetUrl;
    return () => {
      alive = false;
    };
  }, [sheetUrl, atlasUrl]);

  const frames = React.useMemo(() => (atlas && clip ? atlas.animations[clip] ?? [] : []), [atlas, clip]);

  React.useEffect(() => {
    if (!playing || !frames.length) return;
    const t = setInterval(() => setFrame((f) => (f + 1) % frames.length), 1000 / Math.max(1, fps));
    return () => clearInterval(t);
  }, [playing, fps, frames.length]);

  React.useEffect(() => {
    const c = canvasRef.current;
    if (!c || !atlas || !img || !frames.length) return;
    const key = frames[frame % frames.length];
    const f = atlas.frames[key]?.frame;
    if (!f) return;
    c.width = f.w;
    c.height = f.h;
    const g = c.getContext("2d")!;
    g.imageSmoothingEnabled = !pixelArt;
    g.clearRect(0, 0, f.w, f.h);
    g.save();
    if (flip) {
      g.translate(f.w, 0);
      g.scale(-1, 1);
    }
    g.drawImage(img, f.x, f.y, f.w, f.h, 0, 0, f.w, f.h);
    g.restore();
  }, [atlas, img, frames, frame, flip, pixelArt]);

  return (
    <div className="flex flex-col gap-2">
      <div className="checkerboard flex min-h-64 flex-1 items-center justify-center rounded-lg border p-4">
        <canvas ref={canvasRef} className={pixelArt ? "pixelated" : ""} style={{ maxHeight: "100%", maxWidth: "100%", height: 256, imageRendering: pixelArt ? "pixelated" : "auto" }} />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="icon-sm" onClick={() => setPlaying((p) => !p)} aria-label={playing ? "Pause" : "Play"}>
          {playing ? <PauseIcon /> : <PlayIcon />}
        </Button>
        <Select size="sm" className="w-40" value={clip} onValueChange={(v) => { setClip(v); setFrame(0); setFps(atlas?.fps?.[v] ?? fps); }} options={Object.keys(atlas?.animations ?? {}).map((k) => ({ value: k, label: `${k} (${atlas?.animations[k].length} frames)` }))} />
        <div className="flex w-40 items-center gap-2 text-xs">
          <span className="text-muted-foreground w-10">{fps} fps</span>
          <Slider value={fps} onValueChange={setFps} min={1} max={30} />
        </div>
        <Button variant={flip ? "secondary" : "outline"} size="sm" onClick={() => setFlip((f) => !f)}>
          {flip ? "← Left" : "Right →"}
        </Button>
        <span className="text-muted-foreground ml-auto text-xs">
          frame {frames.length ? (frame % frames.length) + 1 : 0}/{frames.length}
        </span>
      </div>
    </div>
  );
}
