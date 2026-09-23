"use client";

import * as React from "react";
import { PauseIcon, PlayIcon, RepeatIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

/** SPEC §17.4 AudioPlayer — wavesurfer.js waveform with loop toggle. */
export function AudioPlayer({ url, loop: initialLoop = false, compact = false }: { url: string; loop?: boolean; compact?: boolean }) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const wsRef = React.useRef<{ playPause: () => void; destroy: () => void; setLoop?: (b: boolean) => void; on: (e: string, cb: (...a: unknown[]) => void) => void; getDuration: () => number; getCurrentTime: () => number; play: () => Promise<void>; seekTo: (n: number) => void } | null>(null);
  const [playing, setPlaying] = React.useState(false);
  const [loop, setLoop] = React.useState(initialLoop);
  const loopRef = React.useRef(loop);
  loopRef.current = loop;
  const [time, setTime] = React.useState({ cur: 0, dur: 0 });

  React.useEffect(() => {
    let ws: typeof wsRef.current = null;
    let disposed = false;
    import("wavesurfer.js").then(({ default: WaveSurfer }) => {
      if (disposed || !containerRef.current) return;
      const instance = WaveSurfer.create({
        container: containerRef.current,
        url,
        height: compact ? 48 : 96,
        waveColor: "#5b5b6b",
        progressColor: "#7C5CFF",
        cursorColor: "#B08CFF",
        barWidth: 2,
        barGap: 1,
        barRadius: 2,
        normalize: true,
      });
      ws = instance as unknown as typeof wsRef.current;
      wsRef.current = ws;
      instance.on("play", () => setPlaying(true));
      instance.on("pause", () => setPlaying(false));
      instance.on("ready", () => setTime({ cur: 0, dur: instance.getDuration() }));
      instance.on("timeupdate", (t: number) => setTime((s) => ({ ...s, cur: t })));
      instance.on("finish", () => {
        if (loopRef.current) {
          instance.seekTo(0);
          void instance.play();
        }
      });
    });
    return () => {
      disposed = true;
      ws?.destroy();
      wsRef.current = null;
    };
  }, [url, compact]);

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
  return (
    <div className="flex flex-col gap-2 rounded-lg border p-3">
      <div ref={containerRef} />
      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon-sm" onClick={() => wsRef.current?.playPause()} aria-label={playing ? "Pause" : "Play"}>
          {playing ? <PauseIcon /> : <PlayIcon />}
        </Button>
        <Button variant={loop ? "secondary" : "ghost"} size="icon-sm" onClick={() => setLoop((l) => !l)} aria-label="Loop">
          <RepeatIcon />
        </Button>
        <span className="text-muted-foreground ml-auto font-mono text-xs">
          {fmt(time.cur)} / {fmt(time.dur)}
        </span>
      </div>
    </div>
  );
}
