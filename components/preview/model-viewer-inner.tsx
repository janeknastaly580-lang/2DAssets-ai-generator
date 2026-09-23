"use client";

import * as React from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Center, useGLTF, useAnimations, Grid } from "@react-three/drei";
import type { Group } from "three";

function Model({ url, wireframe, clip }: { url: string; wireframe: boolean; clip: string | null }) {
  const { scene, animations } = useGLTF(url);
  const ref = React.useRef<Group>(null);
  const { actions, names } = useAnimations(animations, ref);
  React.useEffect(() => {
    scene.traverse((o) => {
      const mesh = o as unknown as { isMesh?: boolean; material?: { wireframe: boolean } | { wireframe: boolean }[] };
      if (mesh.isMesh && mesh.material) {
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        mats.forEach((m) => (m.wireframe = wireframe));
      }
    });
  }, [scene, wireframe]);
  React.useEffect(() => {
    names.forEach((n) => actions[n]?.stop());
    const target = clip && actions[clip] ? actions[clip] : names[0] ? actions[names[0]] : null;
    target?.reset().play();
  }, [actions, names, clip]);
  return (
    <group ref={ref}>
      <primitive object={scene} />
    </group>
  );
}

export interface ModelViewerProps {
  url: string;
  wireframe?: boolean;
  clip?: string | null;
  autoRotate?: boolean;
}

export default function ModelViewerInner({ url, wireframe = false, clip = null, autoRotate = true }: ModelViewerProps) {
  return (
    <Canvas camera={{ position: [2.5, 2, 2.5], fov: 45 }} dpr={[1, 2]}>
      <color attach="background" args={["#18181f"]} />
      {/* No <Environment preset> — it fetches HDRIs from a third-party CDN, which the CSP (SPEC §22) forbids. */}
      <hemisphereLight args={["#e8e8ff", "#2a2a33", 0.9]} />
      <directionalLight position={[5, 8, 5]} intensity={1.6} castShadow />
      <directionalLight position={[-4, 3, -4]} intensity={0.5} />
      <React.Suspense fallback={null}>
        <Center top>
          <Model url={url} wireframe={wireframe} clip={clip} />
        </Center>
      </React.Suspense>
      <Grid args={[10, 10]} cellColor="#3a3a45" sectionColor="#7C5CFF" fadeDistance={12} infiniteGrid />
      <OrbitControls makeDefault autoRotate={autoRotate} autoRotateSpeed={1.2} enableDamping />
    </Canvas>
  );
}
