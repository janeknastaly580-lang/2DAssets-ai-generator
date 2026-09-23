import type { EnginePreset } from "@/lib/validation/misc";

/**
 * Engine export presets (SPEC §10.3–§10.5): which asset_files each preset includes and the
 * README bundled into the ZIP.
 */
export interface FileLike {
  format: string;
  variant: string | null;
  engine_preset: string | null;
}

export function fileMatchesPreset(f: FileLike, preset: EnginePreset, assetType: string): boolean {
  if (f.engine_preset && f.engine_preset !== preset && f.engine_preset !== "generic") return false;
  const isAudio = assetType.startsWith("audio_");
  if (isAudio) {
    if (preset === "unreal") return f.format === "wav";
    if (preset === "unity") return f.format === "wav" || f.format === "ogg";
    if (preset === "godot") return f.format === "ogg" || f.format === "wav";
    return true;
  }
  if (assetType === "model_3d") {
    if (preset === "unity") return ["fbx", "glb", "texture_png"].includes(f.format) && f.variant !== "unreal";
    if (preset === "unreal") return ["fbx", "texture_png"].includes(f.format) && f.variant !== "unity";
    if (preset === "godot") return ["glb", "texture_png"].includes(f.format);
    return true;
  }
  if (assetType === "sprite_animation") {
    if (preset === "godot") return ["png", "tres", "json_atlas", "gif"].includes(f.format);
    if (preset === "unity" || preset === "unreal") return ["png", "json_atlas", "gif"].includes(f.format);
    return true;
  }
  // image
  if (preset === "generic") return true;
  return f.variant !== "x4" && f.variant !== "tile3x3";
}

export function readmeFor(preset: EnginePreset, assetType: string, meta: Record<string, unknown>): { name: string; content: string } | null {
  const pixelGrid = (meta.pixel_grid as number | undefined) ?? null;
  const fps = (meta.clips as { fps?: number }[] | undefined)?.[0]?.fps ?? 12;
  const isAudio = assetType.startsWith("audio_");
  const header = `# Veyraflow export — ${assetType} (${preset})\n\nGenerated with AI. See https://veyraflow.eu/ai-disclosure for licensing notes.\n\n`;
  switch (preset) {
    case "unity": {
      let body = "";
      if (assetType === "sprite_animation" || assetType === "image") {
        body = `## Unity import\n1. Drag the PNG into your project.\n2. Texture Type = **Sprite (2D and UI)**${assetType === "sprite_animation" ? ", Sprite Mode = **Multiple**" : ""}.\n3. Pixels Per Unit = ${pixelGrid ?? 100}${pixelGrid ? " (pixel grid)" : ""}.\n${pixelGrid ? "4. Filter Mode = **Point (no filter)**, Compression = None.\n" : ""}${assetType === "sprite_animation" ? `5. Use the JSON atlas (TexturePacker hash format) with a TexturePacker importer, or slice in the Sprite Editor with a grid of the frame size. Animations are listed under \`animations\` in the JSON; fps = ${fps}.\n` : ""}`;
      } else if (assetType === "model_3d") {
        body = `## Unity import\n- Import the **FBX (unity)** variant (Y-up, metres, scale 1) or the GLB via a glTF importer.\n- Materials: create a URP/HDRP Lit material and assign the texture maps (albedo, normal, roughness/metallic, ao) from the PNGs.\n- Normal maps use the OpenGL convention.\n`;
      } else if (isAudio) {
        body = `## Unity import\n- Load Type: **Decompress On Load** for SFX, **Streaming** for music.\n- OGG is recommended for size; WAV for short SFX.\n`;
      }
      return { name: "README_UNITY.md", content: header + body };
    }
    case "unreal": {
      let body = "";
      if (assetType === "sprite_animation" || assetType === "image") {
        body = `## Unreal (Paper2D) import\n1. Import the PNG; set Compression = UserInterface2D (or Default with Filter = Nearest for pixel art).\n${assetType === "sprite_animation" ? "2. Use **Paper2D Sprite Sheet** import with the JSON file (TexturePacker format) to create sprites and flipbooks; fps = " + fps + ".\n" : ""}`;
      } else if (assetType === "model_3d") {
        body = `## Unreal import\n- Import the **FBX (unreal)** variant (Z-up, centimetres). Import Uniform Scale = 1.\n- Normal maps: both OpenGL and DirectX conventions are provided — use the *directx* one, or flip the green channel.\n`;
      } else if (isAudio) {
        body = `## Unreal import\n- Unreal imports **WAV** only; OGG/MP3 are omitted from this preset.\n- For loops, enable "Looping" on the Sound Wave asset.\n`;
      }
      return { name: "README_UNREAL.md", content: header + body };
    }
    case "godot": {
      let body = "";
      if (assetType === "sprite_animation") {
        body = `## Godot 4 import\n1. Copy the PNG and the \`.tres\` file into your project (same folder).\n2. Add an **AnimatedSprite2D** node and set its Sprite Frames to the \`.tres\` resource.\n${pixelGrid ? "3. In the import dock, set Texture Filter = **Nearest** for pixel art.\n" : ""}`;
      } else if (assetType === "image") {
        body = `## Godot 4 import\n- Drop the PNG into the project.${pixelGrid ? " Set Texture Filter = **Nearest** in Project Settings → Rendering → Textures for pixel art." : ""}\n`;
      } else if (assetType === "model_3d") {
        body = `## Godot 4 import\n- Import the **GLB** (Y-up, metres). Materials and textures are embedded.\n`;
      } else if (isAudio) {
        body = `## Godot 4 import\n- OGG Vorbis is recommended; set **Loop** in the import dock for loops.\n`;
      }
      return { name: "README_GODOT.md", content: header + body };
    }
    default:
      return { name: "README.md", content: header + "All available formats are included.\n" };
  }
}
