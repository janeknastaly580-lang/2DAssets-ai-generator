import sharp from "sharp";

/**
 * Pixel-art pipeline (SPEC §10.2): median pre-filter → nearest downscale to `pixel_grid` →
 * palette quantization (locked project palette in Lab space, or median-cut) → binary alpha.
 * Pure TypeScript, no provider cost.
 */
export type RGB = [number, number, number];

export interface PixelArtOptions {
  pixelGrid: number; // longer side in pixels
  paletteSize?: number; // 8/16/32/64 when no locked palette
  palette?: string[] | null; // locked project palette (#rrggbb)
}

export interface PixelArtResult {
  png1x: Buffer;
  width: number;
  height: number;
  palette: string[];
}

export function hexToRgb(hex: string): RGB {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

export function rgbToHex([r, g, b]: RGB): string {
  return "#" + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
}

// sRGB → CIE Lab (D65)
export function rgbToLab([r, g, b]: RGB): [number, number, number] {
  const f = (c: number) => {
    c /= 255;
    return c > 0.04045 ? Math.pow((c + 0.055) / 1.055, 2.4) : c / 12.92;
  };
  const R = f(r),
    G = f(g),
    B = f(b);
  let x = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047;
  let y = (R * 0.2126 + G * 0.7152 + B * 0.0722) / 1.0;
  let z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
  const g2 = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  x = g2(x);
  y = g2(y);
  z = g2(z);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}

function dist2(a: number[], b: number[]) {
  return (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
}

/** Median-cut colour quantization. */
export function medianCut(pixels: RGB[], colors: number): RGB[] {
  if (pixels.length === 0) return [];
  type Box = RGB[];
  const boxes: Box[] = [pixels];
  while (boxes.length < colors) {
    boxes.sort((a, b) => b.length - a.length);
    const box = boxes.shift()!;
    if (box.length < 2) {
      boxes.push(box);
      break;
    }
    const ranges = [0, 1, 2].map((c) => {
      let min = 255,
        max = 0;
      for (const p of box) {
        if (p[c] < min) min = p[c];
        if (p[c] > max) max = p[c];
      }
      return max - min;
    });
    const ch = ranges.indexOf(Math.max(...ranges));
    box.sort((a, b) => a[ch] - b[ch]);
    const mid = Math.floor(box.length / 2);
    boxes.push(box.slice(0, mid), box.slice(mid));
  }
  return boxes.map((box) => {
    const sum = box.reduce((s, p) => [s[0] + p[0], s[1] + p[1], s[2] + p[2]] as RGB, [0, 0, 0] as RGB);
    return [Math.round(sum[0] / box.length), Math.round(sum[1] / box.length), Math.round(sum[2] / box.length)] as RGB;
  });
}

export async function pixelate(png: Buffer, opts: PixelArtOptions): Promise<PixelArtResult> {
  const meta = await sharp(png).metadata();
  const w0 = meta.width ?? 1;
  const h0 = meta.height ?? 1;
  const scale = opts.pixelGrid / Math.max(w0, h0);
  const width = Math.max(1, Math.round(w0 * scale));
  const height = Math.max(1, Math.round(h0 * scale));

  const { data, info } = await sharp(png)
    .ensureAlpha()
    .median(3)
    .resize(width, height, { kernel: sharp.kernel.nearest })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const opaque: RGB[] = [];
  for (let i = 0; i < data.length; i += info.channels) {
    if (data[i + 3] >= 128) opaque.push([data[i], data[i + 1], data[i + 2]]);
  }

  const paletteRgb: RGB[] =
    opts.palette && opts.palette.length ? opts.palette.map(hexToRgb) : medianCut(opaque, opts.paletteSize ?? 16);
  const paletteLab = paletteRgb.map(rgbToLab);

  const out = Buffer.alloc(width * height * 4);
  const cache = new Map<number, number>();
  for (let i = 0, o = 0; i < data.length; i += info.channels, o += 4) {
    if (data[i + 3] < 128) {
      out[o + 3] = 0;
      continue;
    }
    const key = (data[i] << 16) | (data[i + 1] << 8) | data[i + 2];
    let idx = cache.get(key);
    if (idx === undefined) {
      const lab = rgbToLab([data[i], data[i + 1], data[i + 2]]);
      let best = 0,
        bd = Infinity;
      for (let p = 0; p < paletteLab.length; p++) {
        const d = dist2(lab, paletteLab[p]);
        if (d < bd) {
          bd = d;
          best = p;
        }
      }
      idx = best;
      cache.set(key, idx);
    }
    const c = paletteRgb[idx] ?? [0, 0, 0];
    out[o] = c[0];
    out[o + 1] = c[1];
    out[o + 2] = c[2];
    out[o + 3] = 255;
  }

  const png1x = await sharp(out, { raw: { width, height, channels: 4 } }).png({ palette: true }).toBuffer();
  return { png1x, width, height, palette: paletteRgb.map(rgbToHex) };
}
