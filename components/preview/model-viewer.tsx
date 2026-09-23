"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/overlays";
import { Skeleton } from "@/components/ui/primitives";

const Inner = dynamic(() => import("./model-viewer-inner"), { ssr: false, loading: () => <Skeleton className="h-full w-full" /> });

/** SPEC §17.4 ModelViewer — three.js GLB viewer with orbit, wireframe toggle, animation clips. */
export function ModelViewer({ url, animations = [], textureMaps = [] }: { url: string; animations?: string[]; textureMaps?: string[] }) {
  const [wireframe, setWireframe] = React.useState(false);
  const [rotate, setRotate] = React.useState(true);
  const [clip, setClip] = React.useState<string | null>(animations[0] ?? null);
  return (
    <div className="flex flex-col gap-2">
      <div className="h-80 overflow-hidden rounded-lg border">
        <Inner url={url} wireframe={wireframe} clip={clip} autoRotate={rotate} />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant={wireframe ? "secondary" : "outline"} onClick={() => setWireframe((w) => !w)}>
          Wireframe
        </Button>
        <Button size="sm" variant={rotate ? "secondary" : "outline"} onClick={() => setRotate((r) => !r)}>
          Turntable
        </Button>
        {animations.length > 0 && <Select size="sm" className="w-40" value={clip ?? ""} onValueChange={setClip} options={animations.map((a) => ({ value: a, label: a }))} />}
        {textureMaps.length > 0 && <span className="text-muted-foreground ml-auto text-xs">Maps: {textureMaps.join(", ")}</span>}
      </div>
    </div>
  );
}
