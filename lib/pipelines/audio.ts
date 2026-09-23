import "server-only";
import JSZip from "jszip";
import { env, integrations } from "@/lib/env";
import {
  asFalFile,
  buildMusicInput,
  buildSfxInput,
  buildTtsInput,
  FAL_MODELS,
  SFX_SAMPLE_RATE,
  TTS_DEFAULT_VOICE,
  type FalFile,
} from "@/lib/ai/falModels";
import { falEndpoint, type FalOutput } from "@/lib/ai/providers/fal";
import { workerAdapter } from "@/lib/ai/providers/worker";
import { fetchBuffer } from "@/lib/ai/providers/types";
import { storage, storageKeys } from "@/lib/storage";
import {
  decodePcm16,
  decodeWav,
  durationSeconds,
  encodeWav,
  loopCrossfade,
  normalizePeak,
  synthMock,
  trimSilence,
  waveformPng,
  type PcmAudio,
} from "@/lib/postprocess/audio";
import type { MusicInput, SfxInput, VoiceInput } from "@/lib/validation/jobs";
import { presignedInputUrl } from "./inputs";
import { submitAndWait } from "./providerWait";
import { JobFailure, type OutputAsset, type OutputFile, type PipelineContext, type PipelineResult } from "./types";

/** All three audio generators run on fal.ai (SPEC §9.7); without FAL_KEY they fall back to mock audio. */
const mockAudio = () => integrations.mockProviders || !env.FAL_KEY;

/** Downloads the `audio` file of a fal result. */
async function falAudio(out: FalOutput): Promise<{ buf: Buffer; file: FalFile }> {
  const file = asFalFile(out.data.audio);
  if (!file) throw new JobFailure("provider_output", "fal.ai returned no audio file");
  return { buf: await fetchBuffer(file.url), file };
}

const isMp3 = (buf: Buffer, file: FalFile) =>
  /mpeg|mp3/i.test(`${file.content_type ?? ""} ${file.file_name ?? ""}`) || buf.toString("latin1", 0, 3) === "ID3";

/** WAV when the provider returned PCM (headerless or wrapped), otherwise the encoded file as-is. */
function audioSource(buf: Buffer, file: FalFile, pcmSampleRate?: number): Parameters<typeof bundleAudio>[1] {
  const wav = decodeWav(buf);
  if (wav) return { pcm: wav };
  if (pcmSampleRate && !isMp3(buf, file)) return { pcm: decodePcm16(buf, pcmSampleRate) };
  return { encoded: { buf, ext: "mp3" } };
}

interface AudioBundle {
  files: OutputFile[];
  metadata: Record<string, unknown>;
  preview: Buffer;
}

/**
 * Builds wav/ogg/mp3 outputs. WAV + light DSP run in-process; OGG/MP3 (and LUFS normalisation)
 * come from the ffmpeg worker when configured. In mock mode only WAV is produced.
 */
async function bundleAudio(
  ctx: PipelineContext<unknown>,
  src: { pcm?: PcmAudio; encoded?: { buf: Buffer; ext: "mp3" | "wav" } },
  opts: { peakDb: number; loop?: boolean; loopMs?: number; variant?: string; lufs?: number },
): Promise<AudioBundle> {
  const files: OutputFile[] = [];
  const v = opts.variant ?? "main";
  let pcm = src.pcm ?? (src.encoded?.ext === "wav" ? decodeWav(src.encoded.buf) ?? undefined : undefined);
  if (pcm) {
    pcm = normalizePeak(trimSilence(pcm), opts.peakDb);
    if (opts.loop) pcm = loopCrossfade(pcm, opts.loopMs ?? 30);
    files.push({ format: "wav", variant: v, engine_preset: null, ext: "wav", body: encodeWav(pcm) });
  } else if (src.encoded) {
    files.push({ format: src.encoded.ext, variant: v, engine_preset: null, ext: src.encoded.ext, body: src.encoded.buf });
  }

  // ffmpeg worker: ogg + mp3 (+ wav from mp3, loudnorm)
  if (integrations.worker && !integrations.mockProviders) {
    const st = storage();
    const inKey = storageKeys.upload(ctx.workspace.id, `${ctx.job.id}-${v}-in`, files[0].ext);
    await st.put(inKey, files[0].body, { contentType: files[0].ext === "wav" ? "audio/wav" : "audio/mpeg" });
    const outs: Record<string, string> = {};
    const keys: Record<string, string> = {};
    for (const f of ["wav", "ogg", "mp3"]) {
      keys[f] = storageKeys.upload(ctx.workspace.id, `${ctx.job.id}-${v}-out`, f);
      outs[f] = await st.presignPut(keys[f], "application/octet-stream", 200 * 1024 * 1024);
    }
    await submitAndWait(
      ctx,
      workerAdapter,
      { endpoint: "audio-process", audio_url: await presignedInputUrl(inKey), ops: { peak_db: opts.peakDb, lufs: opts.lufs ?? null, loop_ms: opts.loop ? opts.loopMs ?? 30 : 0 }, output_put_urls: outs },
      { model: "ffmpeg", timeoutMs: 10 * 60_000, pollMs: 5000, progressBase: 70, progressSpan: 15 },
    );
    for (const f of ["wav", "ogg", "mp3"]) {
      const head = await st.head(keys[f]);
      if (!head) continue;
      const body = await st.get(keys[f]);
      const idx = files.findIndex((x) => x.format === f && x.variant === v);
      const of: OutputFile = { format: f, variant: v, engine_preset: null, ext: f, body };
      if (idx >= 0) files[idx] = of;
      else files.push(of);
      await st.delete(keys[f]);
    }
    await st.delete(inKey);
    if (!pcm) {
      const wav = files.find((f) => f.format === "wav");
      if (wav) pcm = decodeWav(wav.body) ?? undefined;
    }
  }

  const duration = pcm ? durationSeconds(pcm) : null;
  const preview = pcm ? await waveformPng(pcm) : await waveformPng(synthMock("silence", 1, "sfx"));
  return {
    files,
    metadata: {
      duration_s: duration != null ? Number(duration.toFixed(3)) : null,
      sample_rate: pcm?.sampleRate ?? 44100,
      channels: pcm?.channels ?? 2,
      loop: Boolean(opts.loop),
    },
    preview,
  };
}

// ---------------------------------------------------------------------------
// §9.4 SFX
// ---------------------------------------------------------------------------
export async function runSfxPipeline(ctx: PipelineContext<SfxInput>): Promise<PipelineResult> {
  const { input } = ctx;
  const assets: OutputAsset[] = [];
  let cost = 0;
  const mock = mockAudio();
  const sfx = falEndpoint(FAL_MODELS.sfx);
  for (let i = 0; i < input.count; i++) {
    await ctx.assertActive();
    const base = 10 + Math.round((i / input.count) * 60);
    await ctx.setProgress(base);
    let src: Parameters<typeof bundleAudio>[1];
    if (mock) {
      src = { pcm: synthMock(`${ctx.translated.prompt}#${i}`, input.duration_s ?? 1.5, "sfx") };
    } else {
      const falInput = buildSfxInput(input, ctx.translated);
      const out = await submitAndWait(ctx, sfx, falInput, { model: FAL_MODELS.sfx, timeoutMs: 10 * 60_000, pollMs: 2000, progressBase: base, progressSpan: 60 / input.count });
      cost += sfx.estimateCostUsd(falInput);
      const { buf, file } = await falAudio(out);
      src = audioSource(buf, file, SFX_SAMPLE_RATE);
    }
    const b = await bundleAudio(ctx, src, { peakDb: -1, loop: input.loop, loopMs: 30 });
    assets.push({
      type: "audio_sfx",
      name: `SFX — ${input.prompt.slice(0, 40)}${input.count > 1 ? ` (${i + 1})` : ""}`,
      prompt: input.prompt,
      metadata: { ...b.metadata, prompt_influence: input.prompt_influence, variant: i + 1, model: mock ? "mock" : FAL_MODELS.sfx },
      files: b.files,
      preview: b.preview,
      providerCostUsd: cost / input.count,
    });
  }
  return { assets, providerCostUsd: Number(cost.toFixed(4)) };
}

// ---------------------------------------------------------------------------
// §9.5 Music
// ---------------------------------------------------------------------------
export async function runMusicPipeline(ctx: PipelineContext<MusicInput>): Promise<PipelineResult> {
  const { input } = ctx;
  let cost = 0;
  let lyrics: string | null = null;
  const mock = mockAudio();
  let src: Parameters<typeof bundleAudio>[1];
  if (mock) {
    src = { pcm: synthMock(ctx.translated.prompt, Math.min(input.duration_s, 20), "music") };
  } else {
    // Lyria 3 Pro has no length parameter: the requested duration travels in the prompt, so the
    // track length is approximate (SPEC §9.5).
    const music = falEndpoint(FAL_MODELS.music);
    const falInput = buildMusicInput(input, ctx.translated);
    const out = await submitAndWait(ctx, music, falInput, { model: FAL_MODELS.music, timeoutMs: 15 * 60_000, pollMs: 5000, progressSpan: 50 });
    cost += music.estimateCostUsd(falInput);
    const { buf, file } = await falAudio(out);
    src = audioSource(buf, file);
    lyrics = typeof out.data.lyrics === "string" && out.data.lyrics.trim() ? out.data.lyrics : null;
  }
  await ctx.setProgress(60);
  const main = await bundleAudio(ctx, src, { peakDb: -1, lufs: -14 });
  const files = [...main.files];
  if (input.loopable) {
    const loop = await bundleAudio(ctx, src, { peakDb: -1, lufs: -14, loop: true, loopMs: 500, variant: "loop" });
    files.push(...loop.files);
  }
  return {
    assets: [
      {
        type: "audio_music",
        name: `Music — ${input.prompt.slice(0, 40)}`,
        prompt: input.prompt,
        metadata: {
          ...main.metadata,
          requested_duration_s: input.duration_s,
          instrumental: input.instrumental,
          loopable: input.loopable,
          bpm: input.bpm ?? null,
          key: input.key ?? null,
          lyrics,
          model: mock ? "mock" : FAL_MODELS.music,
        },
        files,
        preview: main.preview,
        providerCostUsd: cost,
      },
    ],
    providerCostUsd: Number(cost.toFixed(4)),
  };
}

// ---------------------------------------------------------------------------
// §9.6 Voice / TTS — one line = one cue; batch → ZIP
// ---------------------------------------------------------------------------
export async function runVoicePipeline(ctx: PipelineContext<VoiceInput>): Promise<PipelineResult> {
  const { input } = ctx;
  const lines = input.text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const mock = mockAudio();
  const tts = falEndpoint(FAL_MODELS.tts);
  // chosen by the translator LLM from the instructions; provider default until it is connected
  const voice = (buildTtsInput(input, ctx.translated, "").voice as string | undefined) ?? TTS_DEFAULT_VOICE;
  let cost = 0;
  const files: OutputFile[] = [];
  const meta: { index: number; text: string; duration_s: number | null }[] = [];
  const zip = new JSZip();
  let preview: Buffer | undefined;
  for (let i = 0; i < lines.length; i++) {
    await ctx.assertActive();
    const base = 10 + Math.round((i / lines.length) * 60);
    await ctx.setProgress(base);
    let src: Parameters<typeof bundleAudio>[1];
    if (mock) {
      src = { pcm: synthMock(lines[i], Math.min(8, 0.6 + lines[i].length * 0.06), "voice") };
    } else {
      const falInput = buildTtsInput(input, ctx.translated, lines[i]);
      const out = await submitAndWait(ctx, tts, falInput, { model: FAL_MODELS.tts, timeoutMs: 5 * 60_000, pollMs: 1500, progressBase: base, progressSpan: 60 / lines.length });
      cost += tts.estimateCostUsd(falInput);
      const { buf, file } = await falAudio(out);
      src = audioSource(buf, file);
    }
    const variant = lines.length === 1 ? "main" : `line_${String(i + 1).padStart(2, "0")}`;
    const b = await bundleAudio(ctx, src, { peakDb: -3, variant });
    for (const f of b.files) {
      files.push(f);
      if (lines.length > 1) zip.file(`${variant}.${f.ext}`, f.body);
    }
    meta.push({ index: i + 1, text: lines[i], duration_s: (b.metadata.duration_s as number | null) ?? null });
    preview ??= b.preview;
  }
  if (lines.length > 1) {
    files.push({ format: "zip", variant: "batch", engine_preset: null, ext: "zip", body: await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }) });
  }
  return {
    assets: [
      {
        type: "audio_voice",
        name: `Voice — ${lines[0].slice(0, 40)}${lines.length > 1 ? ` (+${lines.length - 1})` : ""}`,
        prompt: input.text,
        metadata: { lines: meta, voice, model: mock ? "mock" : FAL_MODELS.tts, language: input.language, instructions: input.instructions, direction: ctx.translated.prompt },
        files,
        preview,
        providerCostUsd: cost,
      },
    ],
    providerCostUsd: Number(cost.toFixed(4)),
  };
}
