import "server-only";
import sharp from "sharp";

/**
 * Deterministic placeholder renderer for MOCK_PROVIDERS mode — produces a real PNG so the whole
 * post-processing chain (trim, pixel-art, thumbnails, atlases) runs end-to-end without any AI key.
 */
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function hsl(h: number, s: number, l: number) {
  return `hsl(${h % 360} ${s}% ${l}%)`;
}

function escapeXml(s: string) {
  return s.replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export interface MockImageOptions {
  prompt: string;
  width: number;
  height: number;
  transparent: boolean;
  seed?: number | null;
  variant?: number;
  label?: string;
}

export async function renderMockImage(opts: MockImageOptions): Promise<Buffer> {
  const seed = (opts.seed ?? hash(opts.prompt)) + (opts.variant ?? 0) * 7919;
  const h1 = seed % 360;
  const h2 = (seed * 7) % 360;
  const { width: w, height: h } = opts;
  const cx = w / 2;
  const cy = h / 2;
  const r = Math.min(w, h) * 0.32;
  const shapes: string[] = [];
  const n = 4 + (seed % 4);
  for (let i = 0; i < n; i++) {
    const a = ((i / n) * Math.PI * 2 + seed / 100) % (Math.PI * 2);
    const sx = cx + Math.cos(a) * r * 0.55;
    const sy = cy + Math.sin(a) * r * 0.55;
    const sr = r * (0.25 + ((seed >> i) % 5) / 20);
    shapes.push(`<circle cx="${sx.toFixed(1)}" cy="${sy.toFixed(1)}" r="${sr.toFixed(1)}" fill="${hsl(h1 + i * 23, 70, 55)}" opacity="0.9"/>`);
  }
  const words = escapeXml(opts.prompt.slice(0, 40));
  const bg = opts.transparent ? "" : `<rect width="100%" height="100%" fill="url(#g)"/>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${hsl(h2, 50, 18)}"/>
      <stop offset="1" stop-color="${hsl(h2 + 60, 60, 35)}"/>
    </linearGradient>
  </defs>
  ${bg}
  <polygon points="${cx},${cy - r} ${cx + r * 0.9},${cy + r * 0.6} ${cx - r * 0.9},${cy + r * 0.6}" fill="${hsl(h1, 75, 60)}" stroke="${hsl(h1, 60, 25)}" stroke-width="${Math.max(2, w / 128)}"/>
  ${shapes.join("\n  ")}
  <text x="${cx}" y="${h - Math.max(12, h * 0.05)}" font-family="sans-serif" font-size="${Math.max(10, w / 32)}" fill="${opts.transparent ? hsl(h1, 60, 25) : "#ffffff"}" text-anchor="middle">${escapeXml(opts.label ?? "MOCK")} · ${words}</text>
</svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}
