import "server-only";
import sharp from "sharp";

/** SPEC §10.1 — trim transparent margins, optional pad to power of two, pivot metadata. */
export interface TrimResult {
  png: Buffer;
  width: number;
  height: number;
  pivot: { x: number; y: number };
}

export async function trimAndPad(
  input: Buffer,
  opts: { padToPow2?: boolean; pivot: "bottom-center" | "center"; alphaThreshold?: number },
): Promise<TrimResult> {
  const img = sharp(input).ensureAlpha();
  const meta = await img.metadata();
  let trimmed: Buffer;
  try {
    trimmed = await img.trim({ threshold: opts.alphaThreshold ?? 8 }).png().toBuffer();
  } catch {
    trimmed = await img.png().toBuffer();
  }
  let out = sharp(trimmed);
  let { width = meta.width ?? 1, height = meta.height ?? 1 } = await out.metadata();

  if (opts.padToPow2) {
    const target = Math.pow(2, Math.ceil(Math.log2(Math.max(width, height, 2))));
    const left = Math.floor((target - width) / 2);
    const top = opts.pivot === "bottom-center" ? target - height : Math.floor((target - height) / 2);
    out = sharp(
      await out
        .extend({
          left,
          right: target - width - left,
          top,
          bottom: target - height - top,
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .png()
        .toBuffer(),
    );
    width = target;
    height = target;
  }
  const png = await out.png().toBuffer();
  return { png, width, height, pivot: opts.pivot === "bottom-center" ? { x: 0.5, y: 1 } : { x: 0.5, y: 0.5 } };
}

export async function toWebp(png: Buffer, quality = 90): Promise<Buffer> {
  return sharp(png).webp({ quality }).toBuffer();
}

export async function thumbnail(png: Buffer, size = 256): Promise<Buffer> {
  return sharp(png).resize(size, size, { fit: "inside", withoutEnlargement: true }).png().toBuffer();
}

/** Nearest-neighbour upscale for pixel-art previews (SPEC §10.2 step 4). */
export async function nearestUpscale(png: Buffer, factor = 4): Promise<Buffer> {
  const m = await sharp(png).metadata();
  return sharp(png)
    .resize((m.width ?? 1) * factor, (m.height ?? 1) * factor, { kernel: sharp.kernel.nearest })
    .png()
    .toBuffer();
}

/** 3×3 tiled preview for seamless textures (SPEC §9.1). */
export async function tile3x3(png: Buffer): Promise<Buffer> {
  const m = await sharp(png).metadata();
  const w = m.width ?? 1;
  const h = m.height ?? 1;
  const cell = Math.min(256, w);
  const scaled = await sharp(png).resize(cell, Math.round((h * cell) / w)).png().toBuffer();
  const ch = Math.round((h * cell) / w);
  const composites = [];
  for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) composites.push({ input: scaled, left: x * cell, top: y * ch });
  return sharp({ create: { width: cell * 3, height: ch * 3, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite(composites)
    .png()
    .toBuffer();
}

/** Re-encode uploaded images through sharp to strip metadata (SPEC §22). */
export async function sanitizeUpload(buf: Buffer, maxSide = 4096): Promise<{ png: Buffer; width: number; height: number }> {
  const img = sharp(buf, { failOn: "error" }).rotate().resize(maxSide, maxSide, { fit: "inside", withoutEnlargement: true });
  const png = await img.png().toBuffer();
  const m = await sharp(png).metadata();
  return { png, width: m.width ?? 0, height: m.height ?? 0 };
}

/** Extract a dominant palette (SPEC §7.1 `palette` reference kind). */
export async function extractPalette(buf: Buffer, colors = 16): Promise<string[]> {
  const { data, info } = await sharp(buf).resize(64, 64, { fit: "inside" }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const pixels: [number, number, number][] = [];
  for (let i = 0; i < data.length; i += info.channels) {
    if (data[i + 3] < 128) continue;
    pixels.push([data[i], data[i + 1], data[i + 2]]);
  }
  const { medianCut } = await import("./pixelArt");
  return medianCut(pixels, colors).map(([r, g, b]) => "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join(""));
}
