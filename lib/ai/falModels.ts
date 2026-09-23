import { z } from "zod";
import { model3dMode, VOICE_SPEED_MAX, VOICE_SPEED_MIN } from "@/lib/validation/jobs";
import type { AssetType, JobInput, Model3dInput, MusicInput, SfxInput, VoiceInput } from "@/lib/validation/jobs";

/**
 * fal.ai model registry (SPEC §9.7). For each of the six fal endpoints this module decides every
 * provider parameter, from one of three sources:
 *  1. UI — what the user set by hand in the generator form. Mapped deterministically here and
 *     always applied last, so a manual setting can never be overridden.
 *  2. LLM — parameters that are NOT in the UI. The prompt-translator LLM (SPEC §8.3) chooses them
 *     from the prompt and the manual settings (`llmParams` below → `translated.model_params`).
 *     A missing, null or invalid value is simply omitted, i.e. the provider default applies —
 *     which is what happens for all of them while the translator LLM is not connected.
 *  3. Fixed — plumbing the pipeline depends on (file formats, uploaded image URLs).
 * Schemas: https://fal.ai/api/openapi/queue/openapi.json?endpoint_id=<endpoint id>
 */
export const FAL_MODELS = {
  rodinText: "fal-ai/hyper3d/rodin/v2.5/text-to-3d",
  rodinImage: "fal-ai/hyper3d/rodin/v2.5",
  trellis: "fal-ai/trellis",
  sfx: "fal-ai/elevenlabs/sound-effects/v2",
  music: "fal-ai/lyria3/pro",
  tts: "fal-ai/elevenlabs/tts/turbo-v2.5",
} as const;
export type FalModelId = (typeof FAL_MODELS)[keyof typeof FAL_MODELS];

/** A provider parameter the translator LLM chooses (not exposed in the UI). */
export interface LlmParamSpec {
  key: string;
  /** what the LLM should base the value on */
  description: string;
  /** JSON Schema of a non-null value; the translator schema makes every param nullable */
  json: Record<string, unknown>;
  /** validates the value the LLM returned */
  schema: z.ZodType;
}

export interface FalModelSpec {
  endpoint: FalModelId;
  llmParams: LlmParamSpec[];
  /** extra, model-specific instructions for the translator */
  translatorNotes?: string;
}

/** The part of the translator output the builders need (see lib/ai/translator.ts). */
export interface TranslatedForModel {
  prompt: string;
  model_params?: Record<string, unknown>;
}

/** Keeps the LLM-chosen params that are declared for the model and valid; drops everything else. */
export function resolveLlmParams(specs: LlmParamSpec[], modelParams: Record<string, unknown> | undefined): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const s of specs) {
    const v = modelParams?.[s.key];
    if (v === undefined || v === null) continue;
    const parsed = s.schema.safeParse(v);
    if (parsed.success) out[s.key] = parsed.data;
  }
  return out;
}

const clip = (s: string, max: number) => (s.length > max ? s.slice(0, max) : s);

// ---------------------------------------------------------------------------
// 3D — Rodin Gen-2.5 (text-to-3D / image-to-3D)
// ---------------------------------------------------------------------------
const RODIN_PROMPT_MAX = 1024;
/** Rodin takes up to 5 images; Veyraflow caps input photos lower (MODEL_MAX_INPUT_IMAGES). */
const RODIN_MAX_IMAGES = 5;

const bboxSide = z.number().int().min(1).max(2048);
const RODIN_LLM_PARAMS: LlmParamSpec[] = [
  {
    key: "TAPose",
    description:
      "true only when the subject is a humanoid/bipedal character that should stand in a neutral T- or A-pose (ready for rigging). false for props, vehicles, animals, buildings or a character in a specific pose the user asked for.",
    json: { type: "boolean" },
    schema: z.boolean(),
  },
  {
    key: "enable_creative_mode",
    description: "true when the user asks for a stylised, imaginative or exaggerated interpretation rather than a faithful, literal one.",
    json: { type: "boolean" },
    schema: z.boolean(),
  },
  {
    key: "texture_delight",
    description:
      "true removes baked lighting/highlights from the textures — right for assets that the game engine will light. false when the user wants painted/baked lighting (e.g. a hand-painted look).",
    json: { type: "boolean" },
    schema: z.boolean(),
  },
  {
    key: "texture_mode",
    description:
      "Texture generation quality. Keep it consistent with the user's Quality setting (fast → low, standard → medium, high → high) unless the request clearly asks otherwise; null lets the provider pick per tier.",
    json: { type: "string", enum: ["legacy", "extreme-low", "low", "medium", "high"] },
    schema: z.enum(["legacy", "extreme-low", "low", "medium", "high"]),
  },
  {
    key: "bbox_condition",
    description:
      "Relative bounding-box proportions as integers 1–2048: width (x), height (y), length (z) — e.g. {width:100,height:300,length:100} for a tall narrow tower. Only when the request states proportions or dimensions; otherwise null.",
    json: {
      type: "object",
      additionalProperties: false,
      properties: {
        width: { type: "integer", minimum: 1, maximum: 2048 },
        height: { type: "integer", minimum: 1, maximum: 2048 },
        length: { type: "integer", minimum: 1, maximum: 2048 },
      },
      required: ["width", "height", "length"],
    },
    schema: z.object({ width: bboxSide, height: bboxSide, length: bboxSide }),
  },
];

const RODIN_TIER = { fast: "Gen-2.5-Low", standard: "Gen-2.5-Medium", high: "Gen-2.5-High" } as const;
const RODIN_TRIANGLES: [number, string][] = [
  [2_000, "2K Triangle"],
  [20_000, "20K Triangle"],
  [50_000, "50K Triangle"],
  [150_000, "150K Triangle"],
  [500_000, "500K Triangle"],
  [1_000_000, "1M Triangle"],
  [2_000_000, "2M Triangle"],
];
const RODIN_QUADS: [number, string][] = [
  [4_000, "4K Quad"],
  [8_000, "8K Quad"],
  [18_000, "18K Quad"],
  [50_000, "50K Quad"],
  [100_000, "100K Quad"],
  [200_000, "200K Quad"],
];

/** Closest mesh option to the requested face count; ties go to the lighter mesh. */
function nearestMesh(options: [number, string][], target: number): [number, string] {
  return options.reduce((best, o) => (Math.abs(o[0] - target) < Math.abs(best[0] - target) ? o : best));
}

/**
 * UI Quality → tier, Polycount + Topology → quality_mesh_option. The High tiers accept 20K+
 * triangles only, so a 2K-triangle mesh drops the tier to Medium: the polycount budget wins.
 */
export function rodinMeshSettings(ui: Pick<Model3dInput, "quality" | "target_polycount" | "topology">) {
  const [faces, mesh] = nearestMesh(ui.topology === "quad" ? RODIN_QUADS : RODIN_TRIANGLES, ui.target_polycount);
  let tier: string = RODIN_TIER[ui.quality];
  if (ui.topology === "triangle" && faces < 20_000 && tier === RODIN_TIER.high) tier = RODIN_TIER.standard;
  return { tier, quality_mesh_option: mesh };
}

export function buildRodinInput(
  ui: Model3dInput,
  t: TranslatedForModel,
  images: { urls: string[]; hasTransparency: boolean } = { urls: [], hasTransparency: false },
): Record<string, unknown> {
  const llm = resolveLlmParams(RODIN_LLM_PARAMS, t.model_params);
  const input: Record<string, unknown> = {
    ...llm,
    prompt: clip(t.prompt.trim(), RODIN_PROMPT_MAX),
    ...rodinMeshSettings(ui),
    material: ui.pbr ? "PBR" : "Shaded",
    hd_texture: ui.quality === "high",
    ...(ui.texture_resolution === "4K" ? { addons: { high_pack: true } } : {}),
    // Auto-rig needs a neutral pose; the rigging model itself is connected separately (SPEC §9.3).
    ...(ui.rig ? { TAPose: true } : {}),
    geometry_file_format: "glb",
  };
  if (images.urls.length === 0) return input;
  return {
    ...input,
    image_urls: images.urls.slice(0, RODIN_MAX_IMAGES),
    use_original_alpha: images.hasTransparency,
    preview_render: true,
  };
}

// ---------------------------------------------------------------------------
// 3D — TRELLIS (image-to-3D, one photo)
// ---------------------------------------------------------------------------
const trellisGuidance = z.number().min(0).max(10);
const TRELLIS_LLM_PARAMS: LlmParamSpec[] = [
  {
    key: "ss_guidance_strength",
    description:
      "0–10, how strictly the overall 3D shape follows the photo (provider default 7.5). Higher for a faithful copy of the photographed object, lower when the user wants a cleaner, simplified shape.",
    json: { type: "number", minimum: 0, maximum: 10 },
    schema: trellisGuidance,
  },
  {
    key: "slat_guidance_strength",
    description:
      "0–10, how strictly surface detail and texture follow the photo (provider default 3). Higher keeps fine detail, lower smooths it out.",
    json: { type: "number", minimum: 0, maximum: 10 },
    schema: trellisGuidance,
  },
];
/** UI Quality → sampling steps for both stages (provider default 12). */
const TRELLIS_STEPS = { fast: 12, standard: 20, high: 30 } as const;
/** UI Polycount → simplification factor 0.9–0.98 (higher = fewer faces, provider default 0.95). */
const TRELLIS_SIMPLIFY: Record<Model3dInput["target_polycount"], number> = { 1000: 0.98, 5000: 0.97, 20000: 0.95, 100000: 0.9 };

export function buildTrellisInput(ui: Model3dInput, t: TranslatedForModel, imageUrl: string): Record<string, unknown> {
  return {
    ...resolveLlmParams(TRELLIS_LLM_PARAMS, t.model_params),
    image_url: imageUrl,
    ss_sampling_steps: TRELLIS_STEPS[ui.quality],
    slat_sampling_steps: TRELLIS_STEPS[ui.quality],
    texture_size: ui.texture_resolution === "1K" ? 1024 : 2048,
    mesh_simplify: TRELLIS_SIMPLIFY[ui.target_polycount],
  };
}

// ---------------------------------------------------------------------------
// SFX — ElevenLabs Sound Effects v2
// ---------------------------------------------------------------------------
/**
 * Raw 16-bit PCM at 44.1 kHz: the pipeline wraps it into WAV itself, so trimming, peak
 * normalisation, loop crossfade and the waveform preview all work without the ffmpeg worker.
 */
export const SFX_OUTPUT_FORMAT = "pcm_44100";
export const SFX_SAMPLE_RATE = 44_100;

export function buildSfxInput(ui: SfxInput, t: TranslatedForModel): Record<string, unknown> {
  return {
    text: clip(t.prompt.trim(), 450),
    ...(ui.duration_s ? { duration_seconds: ui.duration_s } : {}),
    loop: ui.loop,
    prompt_influence: ui.prompt_influence,
    output_format: SFX_OUTPUT_FORMAT,
  };
}

// ---------------------------------------------------------------------------
// Music — Lyria 3 Pro
// ---------------------------------------------------------------------------
/**
 * Lyria takes nothing but the prompt, so the form fields are written into it as plain
 * constraints. They are appended here (always, deterministically) rather than left to the LLM.
 */
export function musicConstraints(ui: MusicInput): string {
  return [
    `Length: about ${ui.duration_s} seconds.`,
    ui.bpm ? `Tempo: ${ui.bpm} BPM.` : null,
    ui.key ? `Key: ${ui.key}.` : null,
    ui.instrumental ? "Instrumental only — no vocals, no lyrics." : null,
    ui.loopable ? "Let the ending lead seamlessly back into the opening so the track can loop." : null,
  ]
    .filter(Boolean)
    .join(" ");
}

export function buildMusicInput(ui: MusicInput, t: TranslatedForModel): Record<string, unknown> {
  const constraints = musicConstraints(ui);
  return { prompt: `${clip(t.prompt.trim(), 5000 - constraints.length - 2)}\n\n${constraints}` };
}

// ---------------------------------------------------------------------------
// Voice — ElevenLabs TTS Turbo v2.5
// ---------------------------------------------------------------------------
/** Preset voices of the endpoint (ElevenLabs premade library). Rachel is the provider default. */
export const TTS_VOICES = [
  ["Rachel", "female, American, young adult — calm, clear narration (provider default)"],
  ["Aria", "female, American, middle-aged — expressive, slightly husky"],
  ["Sarah", "female, American, young — soft, reassuring"],
  ["Laura", "female, American, young — upbeat, quirky"],
  ["Charlotte", "female, Swedish-accented English, young — sensual, alluring"],
  ["Alice", "female, British, middle-aged — confident, clear announcer"],
  ["Matilda", "female, American, middle-aged — friendly, warm"],
  ["Jessica", "female, American, young — expressive, playful"],
  ["Lily", "female, British, middle-aged — warm, slightly raspy"],
  ["River", "non-binary, American, middle-aged — calm, neutral"],
  ["Roger", "male, American, middle-aged — confident, casual"],
  ["Charlie", "male, Australian, young — natural, casual"],
  ["George", "male, British, middle-aged — warm, raspy storyteller"],
  ["Callum", "male, transatlantic, middle-aged — intense, gravelly (villain, trickster)"],
  ["Liam", "male, American, young — articulate, energetic"],
  ["Will", "male, American, young — friendly, chill"],
  ["Eric", "male, American, middle-aged — smooth, friendly"],
  ["Chris", "male, American, middle-aged — casual, natural"],
  ["Brian", "male, American, middle-aged — deep, resonant narrator"],
  ["Daniel", "male, British, middle-aged — authoritative newsreader"],
  ["Bill", "male, American, old — trustworthy, crisp documentary narrator"],
] as const;
const TTS_VOICE_NAMES = TTS_VOICES.map(([name]) => name) as unknown as [string, ...string[]];
/** Used when the translator LLM picks no voice (provider default). */
export const TTS_DEFAULT_VOICE = "Rachel";

const TTS_LLM_PARAMS: LlmParamSpec[] = [
  {
    key: "voice",
    description: `Preset voice that best matches the delivery instructions (gender, age, accent, timbre, character). Options: ${TTS_VOICES.map(([n, d]) => `${n} (${d})`).join("; ")}.`,
    json: { type: "string", enum: TTS_VOICE_NAMES },
    schema: z.enum(TTS_VOICE_NAMES),
  },
  {
    key: "apply_text_normalization",
    description:
      "'on' when the lines contain numbers, dates, units or abbreviations that must be spoken as words; 'off' when they must be read exactly as written; 'auto' otherwise.",
    json: { type: "string", enum: ["auto", "on", "off"] },
    schema: z.enum(["auto", "on", "off"]),
  },
];

/** One cue = one call; the spoken text is never rewritten (SPEC §9.6). */
export function buildTtsInput(ui: VoiceInput, t: TranslatedForModel, line: string): Record<string, unknown> {
  return {
    ...resolveLlmParams(TTS_LLM_PARAMS, t.model_params),
    text: line,
    language_code: ui.language,
    stability: ui.stability,
    similarity_boost: ui.similarity_boost,
    style: ui.style,
    speed: Math.min(VOICE_SPEED_MAX, Math.max(VOICE_SPEED_MIN, ui.speed)),
  };
}

// ---------------------------------------------------------------------------
// Routing, translator spec, cost
// ---------------------------------------------------------------------------
/** Which fal endpoint serves a job — used for pricing (jobs.provider_model), translation and generation. */
export function falModelFor(type: AssetType, input: JobInput): FalModelSpec {
  switch (type) {
    case "model_3d": {
      const m = input as Model3dInput;
      if (m.engine === "trellis") {
        return {
          endpoint: FAL_MODELS.trellis,
          llmParams: TRELLIS_LLM_PARAMS,
          translatorNotes: "TRELLIS takes only the photo — the prompt is not sent to it. Use the request only to choose the model_params.",
        };
      }
      return {
        endpoint: model3dMode(m) === "image_to_3d" ? FAL_MODELS.rodinImage : FAL_MODELS.rodinText,
        llmParams: RODIN_LLM_PARAMS,
        translatorNotes: `The prompt must stay under ${RODIN_PROMPT_MAX} characters. With input photos it is optional guidance; keep it empty if the user wrote nothing.`,
      };
    }
    case "audio_sfx":
      return { endpoint: FAL_MODELS.sfx, llmParams: [], translatorNotes: "The prompt must stay under 450 characters." };
    case "audio_music":
      return {
        endpoint: FAL_MODELS.music,
        llmParams: [],
        translatorNotes:
          "Describe genre, mood, instrumentation and structure. Length, tempo (BPM), key, instrumental and loop constraints from the form are appended automatically — do not repeat them. Lyria has no negative prompt.",
      };
    case "audio_voice":
      return { endpoint: FAL_MODELS.tts, llmParams: TTS_LLM_PARAMS };
  }
}

/** Serializable spec handed to the translator (`model_params_spec`). */
export function llmParamsForTranslator(spec: FalModelSpec) {
  return spec.llmParams.map((p) => ({ key: p.key, description: p.description, schema: p.json }));
}

/** fal list prices (SPEC §11.1, checked 2026-09-23); drives jobs.provider_cost_usd. */
export function estimateFalCostUsd(endpoint: string, input: Record<string, unknown>): number {
  switch (endpoint) {
    case FAL_MODELS.rodinText:
    case FAL_MODELS.rodinImage:
      return 0.4;
    case FAL_MODELS.trellis:
      return 0.02;
    case FAL_MODELS.sfx:
      return 0.002 * (typeof input.duration_seconds === "number" ? input.duration_seconds : 5);
    case FAL_MODELS.music:
      return 0.08;
    case FAL_MODELS.tts:
      return (0.05 * String(input.text ?? "").length) / 1000;
    default:
      return 0.05;
  }
}

// ---------------------------------------------------------------------------
// Output helpers
// ---------------------------------------------------------------------------
export interface FalFile {
  url: string;
  file_name?: string | null;
  content_type?: string | null;
}

export function asFalFile(v: unknown): FalFile | null {
  return v && typeof v === "object" && typeof (v as FalFile).url === "string" && (v as FalFile).url ? (v as FalFile) : null;
}

export function asFalFiles(v: unknown): FalFile[] {
  return Array.isArray(v) ? v.map(asFalFile).filter((f): f is FalFile => f !== null) : [];
}
