/**
 * Audio helpers (SPEC §9.4–§9.6, §10.5). Pure TypeScript: WAV encode/decode, peak normalisation,
 * silence trim and loop crossfade. OGG/MP3 encoding and EBU R128 loudness normalisation need
 * ffmpeg and are delegated to the Modal worker (`/audio-process`) when it is configured.
 */
export interface PcmAudio {
  sampleRate: number;
  channels: number;
  samples: Float32Array[]; // per channel, -1..1
}

export function encodeWav(audio: PcmAudio): Buffer {
  const { sampleRate, channels, samples } = audio;
  const frames = samples[0]?.length ?? 0;
  const dataLen = frames * channels * 2;
  const buf = Buffer.alloc(44 + dataLen);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + dataLen, 4);
  buf.write("WAVE", 8);
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(channels, 22);
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * channels * 2, 28);
  buf.writeUInt16LE(channels * 2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(dataLen, 40);
  let o = 44;
  for (let i = 0; i < frames; i++) {
    for (let c = 0; c < channels; c++) {
      const v = Math.max(-1, Math.min(1, samples[c][i] ?? 0));
      buf.writeInt16LE(Math.round(v * 32767), o);
      o += 2;
    }
  }
  return buf;
}

export function decodeWav(buf: Buffer): PcmAudio | null {
  if (buf.toString("ascii", 0, 4) !== "RIFF" || buf.toString("ascii", 8, 12) !== "WAVE") return null;
  let off = 12;
  let channels = 1,
    sampleRate = 44100,
    bits = 16;
  let data: Buffer | null = null;
  while (off + 8 <= buf.length) {
    const id = buf.toString("ascii", off, off + 4);
    const size = buf.readUInt32LE(off + 4);
    if (id === "fmt ") {
      channels = buf.readUInt16LE(off + 10);
      sampleRate = buf.readUInt32LE(off + 12);
      bits = buf.readUInt16LE(off + 22);
    } else if (id === "data") {
      data = buf.subarray(off + 8, off + 8 + size);
      break;
    }
    off += 8 + size + (size % 2);
  }
  if (!data || bits !== 16) return null;
  const frames = Math.floor(data.length / (channels * 2));
  const samples = Array.from({ length: channels }, () => new Float32Array(frames));
  for (let i = 0; i < frames; i++) {
    for (let c = 0; c < channels; c++) samples[c][i] = data.readInt16LE((i * channels + c) * 2) / 32768;
  }
  return { sampleRate, channels, samples };
}

/** Headerless signed 16-bit little-endian PCM (e.g. ElevenLabs `pcm_44100` output) → PcmAudio. */
export function decodePcm16(buf: Buffer, sampleRate: number, channels = 1): PcmAudio {
  const frames = Math.floor(buf.length / (channels * 2));
  const samples = Array.from({ length: channels }, () => new Float32Array(frames));
  for (let i = 0; i < frames; i++) {
    for (let c = 0; c < channels; c++) samples[c][i] = buf.readInt16LE((i * channels + c) * 2) / 32768;
  }
  return { sampleRate, channels, samples };
}

/** Peak normalisation to `dbfs` (e.g. -1 for SFX, -3 for voice). */
export function normalizePeak(a: PcmAudio, dbfs: number): PcmAudio {
  let peak = 0;
  for (const ch of a.samples) for (let i = 0; i < ch.length; i++) peak = Math.max(peak, Math.abs(ch[i]));
  if (peak === 0) return a;
  const target = Math.pow(10, dbfs / 20);
  const g = target / peak;
  return { ...a, samples: a.samples.map((ch) => ch.map((v) => v * g)) };
}

/** Trim leading/trailing silence below `thresholdDb` (default -60 dB). */
export function trimSilence(a: PcmAudio, thresholdDb = -60): PcmAudio {
  const th = Math.pow(10, thresholdDb / 20);
  const n = a.samples[0].length;
  let start = 0,
    end = n - 1;
  const loud = (i: number) => a.samples.some((ch) => Math.abs(ch[i]) > th);
  while (start < n && !loud(start)) start++;
  while (end > start && !loud(end)) end--;
  const pad = Math.round(a.sampleRate * 0.01);
  start = Math.max(0, start - pad);
  end = Math.min(n - 1, end + pad);
  return { ...a, samples: a.samples.map((ch) => ch.slice(start, end + 1)) };
}

/** Loop crossfade: blends the tail into the head so the seam is inaudible (SPEC §9.4/§9.5). */
export function loopCrossfade(a: PcmAudio, ms: number): PcmAudio {
  const n = a.samples[0].length;
  const f = Math.min(Math.round((a.sampleRate * ms) / 1000), Math.floor(n / 2));
  if (f <= 0) return a;
  const out = a.samples.map((ch) => {
    const res = ch.slice(0, n - f);
    for (let i = 0; i < f; i++) {
      const t = i / f;
      res[i] = ch[i] * t + ch[n - f + i] * (1 - t);
    }
    return res;
  });
  return { ...a, samples: out };
}

/** Deterministic mock synthesiser (MOCK_PROVIDERS): layered tones + noise shaped by the prompt. */
export function synthMock(prompt: string, seconds: number, kind: "sfx" | "music" | "voice", sampleRate = 44100): PcmAudio {
  let seed = 0;
  for (const c of prompt) seed = (seed * 31 + c.charCodeAt(0)) >>> 0;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0xffffffff;
  };
  const n = Math.round(seconds * sampleRate);
  const left = new Float32Array(n);
  const right = new Float32Array(n);
  const base = 110 + rand() * 330;
  const notes = kind === "music" ? [0, 3, 7, 10, 12].map((s) => base * Math.pow(2, s / 12)) : [base, base * 1.5];
  for (let i = 0; i < n; i++) {
    const t = i / sampleRate;
    let v = 0;
    if (kind === "sfx") {
      const env = Math.exp(-t * 4);
      v = (Math.sin(2 * Math.PI * base * t * (1 - t * 0.3)) * 0.6 + (rand() * 2 - 1) * 0.3) * env;
    } else if (kind === "music") {
      const step = Math.floor(t * 2) % notes.length;
      const env = 1 - ((t * 2) % 1) * 0.6;
      v = Math.sin(2 * Math.PI * notes[step] * t) * 0.35 * env + Math.sin(2 * Math.PI * notes[0] * 0.5 * t) * 0.15;
    } else {
      const syll = Math.floor(t * 5) % 3;
      const env = 0.5 + 0.5 * Math.sin(2 * Math.PI * 5 * t);
      v = Math.sin(2 * Math.PI * (140 + syll * 30) * t) * 0.4 * env + (rand() * 2 - 1) * 0.05;
    }
    left[i] = v;
    right[i] = v * 0.95;
  }
  return { sampleRate, channels: kind === "voice" ? 1 : 2, samples: kind === "voice" ? [left] : [left, right] };
}

export function durationSeconds(a: PcmAudio) {
  return a.samples[0].length / a.sampleRate;
}

/** Waveform PNG thumbnail (SPEC §9.4) — rendered through sharp from SVG. */
export async function waveformPng(a: PcmAudio, width = 512, height = 128): Promise<Buffer> {
  const sharp = (await import("sharp")).default;
  const ch = a.samples[0];
  const cols = width;
  const per = Math.max(1, Math.floor(ch.length / cols));
  const bars: string[] = [];
  for (let x = 0; x < cols; x++) {
    let peak = 0;
    for (let i = x * per; i < (x + 1) * per && i < ch.length; i++) peak = Math.max(peak, Math.abs(ch[i]));
    const hgt = Math.max(1, peak * (height - 4));
    bars.push(`<rect x="${x}" y="${(height - hgt) / 2}" width="1" height="${hgt}" fill="#7C5CFF"/>`);
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#18181f"/>${bars.join("")}</svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}
