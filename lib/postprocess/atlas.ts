import sharp from "sharp";

type OverlayOptions = Parameters<ReturnType<typeof sharp>["composite"]>[0][number];

/**
 * Sprite sheet packer + TexturePacker "hash" JSON + Godot SpriteFrames .tres (SPEC §10.3).
 * Grid packer: equal-size frames, columns = min(frames, floor(4096 / frame_w)), padding 2 px,
 * no rotation, no trim (stable pivot).
 */
export interface ClipFrames {
  name: string;
  fps: number;
  loop: boolean;
  frames: Buffer[]; // PNG buffers, all the same size
}

export interface PackedSheet {
  png: Buffer;
  width: number;
  height: number;
  frameWidth: number;
  frameHeight: number;
  columns: number;
  atlas: TexturePackerAtlas;
  tres: string;
  frameOrder: { clip: string; index: number; x: number; y: number }[];
}

export interface TexturePackerAtlas {
  frames: Record<
    string,
    {
      frame: { x: number; y: number; w: number; h: number };
      rotated: boolean;
      trimmed: boolean;
      spriteSourceSize: { x: number; y: number; w: number; h: number };
      sourceSize: { w: number; h: number };
      pivot: { x: number; y: number };
    }
  >;
  animations: Record<string, string[]>;
  fps: Record<string, number>;
  meta: { app: string; version: string; image: string; format: string; size: { w: number; h: number }; scale: string };
}

export const MAX_SHEET_WIDTH = 4096;
export const PADDING = 2;

export async function packSpriteSheet(
  clips: ClipFrames[],
  opts: { imageName: string; pivot?: { x: number; y: number } },
): Promise<PackedSheet> {
  const all = clips.flatMap((c) => c.frames.map((f, i) => ({ clip: c.name, index: i, buf: f })));
  if (!all.length) throw new Error("No frames to pack");
  const meta = await sharp(all[0].buf).metadata();
  const fw = meta.width ?? 1;
  const fh = meta.height ?? 1;
  const columns = Math.max(1, Math.min(all.length, Math.floor((MAX_SHEET_WIDTH + PADDING) / (fw + PADDING))));
  const rows = Math.ceil(all.length / columns);
  const width = columns * fw + (columns - 1) * PADDING;
  const height = rows * fh + (rows - 1) * PADDING;
  const pivot = opts.pivot ?? { x: 0.5, y: 1 };

  const composites: OverlayOptions[] = [];
  const frameOrder: PackedSheet["frameOrder"] = [];
  const atlas: TexturePackerAtlas = {
    frames: {},
    animations: {},
    fps: {},
    meta: { app: "Veyraflow", version: "1.0", image: opts.imageName, format: "RGBA8888", size: { w: width, h: height }, scale: "1" },
  };

  all.forEach((f, n) => {
    const col = n % columns;
    const row = Math.floor(n / columns);
    const x = col * (fw + PADDING);
    const y = row * (fh + PADDING);
    composites.push({ input: f.buf, left: x, top: y });
    const key = `${f.clip}_${String(f.index).padStart(3, "0")}`;
    atlas.frames[key] = {
      frame: { x, y, w: fw, h: fh },
      rotated: false,
      trimmed: false,
      spriteSourceSize: { x: 0, y: 0, w: fw, h: fh },
      sourceSize: { w: fw, h: fh },
      pivot,
    };
    (atlas.animations[f.clip] ??= []).push(key);
    frameOrder.push({ clip: f.clip, index: f.index, x, y });
  });
  for (const c of clips) atlas.fps[c.name] = c.fps;

  const png = await sharp({ create: { width, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite(composites)
    .png()
    .toBuffer();

  return {
    png,
    width,
    height,
    frameWidth: fw,
    frameHeight: fh,
    columns,
    atlas,
    tres: buildGodotSpriteFrames(clips, atlas, opts.imageName),
    frameOrder,
  };
}

/** Godot 4 SpriteFrames resource referencing the sheet through AtlasTexture sub-resources. */
export function buildGodotSpriteFrames(clips: ClipFrames[], atlas: TexturePackerAtlas, imageName: string): string {
  const lines: string[] = [];
  let subCount = 0;
  const frameIds: Record<string, string[]> = {};
  for (const clip of clips) {
    frameIds[clip.name] = [];
    for (const key of atlas.animations[clip.name] ?? []) {
      subCount++;
      const id = `AtlasTexture_${subCount}`;
      const f = atlas.frames[key].frame;
      lines.push(`[sub_resource type="AtlasTexture" id="${id}"]`);
      lines.push(`atlas = ExtResource("1_sheet")`);
      lines.push(`region = Rect2(${f.x}, ${f.y}, ${f.w}, ${f.h})`);
      lines.push("");
      frameIds[clip.name].push(id);
    }
  }
  const anims = clips
    .map((clip) => {
      const frames = frameIds[clip.name].map((id) => `{\n"duration": 1.0,\n"texture": SubResource("${id}")\n}`).join(", ");
      return `{\n"frames": [${frames}],\n"loop": ${clip.loop ? "true" : "false"},\n"name": &"${clip.name}",\n"speed": ${clip.fps.toFixed(1)}\n}`;
    })
    .join(", ");
  return [
    `[gd_resource type="SpriteFrames" load_steps=${subCount + 2} format=3]`,
    "",
    `[ext_resource type="Texture2D" path="res://${imageName}" id="1_sheet"]`,
    "",
    ...lines,
    "[resource]",
    `animations = [${anims}]`,
    "",
  ].join("\n");
}
