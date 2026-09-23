import { z } from "zod";

export const ASSET_TYPES = ["model_3d", "audio_sfx", "audio_music", "audio_voice"] as const;
export type AssetType = (typeof ASSET_TYPES)[number];

// ---------------------------------------------------------------------------
// §9.3 3D
// ---------------------------------------------------------------------------
export const MODEL_QUALITIES = ["fast", "standard", "high"] as const;
/** Clips for the auto-rig option. The rigging/animation model (fal.ai) is not connected yet (SPEC §9.3). */
export const RIG_ANIMATIONS = ["idle", "walk", "run", "jump", "attack", "death"] as const;

/**
 * §9.3 — selectable 3D engines, both on fal.ai (SPEC §9.7): Rodin Gen-2.5 (text and/or photos)
 * and TRELLIS (exactly one photo; triangles only; textures up to 2K).
 */
export const MODEL_ENGINES = ["rodin", "trellis"] as const;
export type ModelEngine = (typeof MODEL_ENGINES)[number];

export const MODEL_ENGINE_LABELS: Record<ModelEngine, { name: string; note: string }> = {
  rodin: { name: "Rodin Gen-2.5", note: "Text and/or photos · higher quality, uses more of your credit limit" },
  trellis: { name: "TRELLIS (Microsoft)", note: "Needs one photo · uses less of your credit limit" },
};

/** Hard cap; the per-plan cap lives in PLANS[plan].maxInputImages (SPEC §11.3). */
export const MODEL_MAX_INPUT_IMAGES = 3;

const imageRefSchema = z.object({ kind: z.enum(["reference", "asset", "upload"]), id: z.string().uuid() });

export const model3dInputSchema = z
  .object({
    prompt: z.string().trim().max(1500).optional().default(""),
    /** Up to 3 input photos; combined freely with the prompt (SPEC §9.3). */
    images: z.array(imageRefSchema).max(MODEL_MAX_INPUT_IMAGES).default([]),
    engine: z.enum(MODEL_ENGINES).default("rodin"),
    quality: z.enum(MODEL_QUALITIES).default("standard"),
    target_polycount: z.union([z.literal(1000), z.literal(5000), z.literal(20000), z.literal(100000)]).default(20000),
    topology: z.enum(["triangle", "quad"]).default("triangle"),
    pbr: z.boolean().default(true),
    texture_resolution: z.enum(["1K", "2K", "4K"]).default("2K"),
    rig: z.boolean().default(false),
    animations: z.array(z.enum(RIG_ANIMATIONS)).max(6).default([]),
    real_world_size_m: z.number().positive().max(1000).optional().nullable(),
    parent_asset_id: z.string().uuid().optional().nullable(),
  })
  .refine((v) => v.prompt.length > 0 || v.images.length > 0, {
    message: "Describe the model, attach a photo, or both",
    path: ["prompt"],
  })
  .refine((v) => v.engine !== "trellis" || v.images.length === 1, {
    message: "TRELLIS turns exactly one photo into 3D — attach one photo or switch to Rodin",
    path: ["images"],
  })
  .refine((v) => v.engine !== "trellis" || v.topology === "triangle", {
    message: "TRELLIS produces triangle meshes only",
    path: ["topology"],
  })
  .refine((v) => v.engine !== "trellis" || v.texture_resolution !== "4K", {
    message: "TRELLIS textures go up to 2K",
    path: ["texture_resolution"],
  });

/** Derived, not a user field: any attached photo makes it an image-to-3D run. */
export function model3dMode(input: { images: unknown[] }): "text_to_3d" | "image_to_3d" {
  return input.images.length > 0 ? "image_to_3d" : "text_to_3d";
}

// ---------------------------------------------------------------------------
// §9.4 SFX
// ---------------------------------------------------------------------------
/** §9.4 — ElevenLabs Sound Effects v2 (fal.ai) accepts up to 22 s; Veyraflow caps it at 10 s. */
export const SFX_MAX_DURATION_S = 10;

export const sfxInputSchema = z.object({
  prompt: z.string().trim().min(1).max(450),
  duration_s: z.number().min(0.5).max(SFX_MAX_DURATION_S).optional().nullable(),
  loop: z.boolean().default(false),
  prompt_influence: z.number().min(0).max(1).default(0.3),
  count: z.number().int().min(1).max(4).default(1),
});

// ---------------------------------------------------------------------------
// §9.5 Music
// ---------------------------------------------------------------------------
/** Lyria 3 Pro has no length parameter — the duration is requested in the prompt, so it is approximate. */
export const MUSIC_DURATIONS = [15, 30, 60, 120, 180] as const;
export const musicInputSchema = z.object({
  prompt: z.string().trim().min(1).max(1500),
  duration_s: z.union([z.literal(15), z.literal(30), z.literal(60), z.literal(120), z.literal(180)]).default(30),
  instrumental: z.boolean().default(true),
  loopable: z.boolean().default(false),
  bpm: z.number().int().min(40).max(300).optional().nullable(),
  key: z.string().max(10).optional().nullable(),
});

// ---------------------------------------------------------------------------
// §9.6 Voice
// ---------------------------------------------------------------------------
/** §9.6 — languages offered in the TTS picker = the 32 languages of ElevenLabs Turbo v2.5. */
export const VOICE_LANGUAGES = [
  { code: "en", label: "English" },
  { code: "es", label: "Spanish" },
  { code: "fr", label: "French" },
  { code: "de", label: "German" },
  { code: "it", label: "Italian" },
  { code: "pt", label: "Portuguese" },
  { code: "pl", label: "Polish" },
  { code: "nl", label: "Dutch" },
  { code: "sv", label: "Swedish" },
  { code: "da", label: "Danish" },
  { code: "fi", label: "Finnish" },
  { code: "no", label: "Norwegian" },
  { code: "cs", label: "Czech" },
  { code: "sk", label: "Slovak" },
  { code: "hu", label: "Hungarian" },
  { code: "ro", label: "Romanian" },
  { code: "bg", label: "Bulgarian" },
  { code: "hr", label: "Croatian" },
  { code: "el", label: "Greek" },
  { code: "tr", label: "Turkish" },
  { code: "uk", label: "Ukrainian" },
  { code: "ru", label: "Russian" },
  { code: "ar", label: "Arabic" },
  { code: "hi", label: "Hindi" },
  { code: "ta", label: "Tamil" },
  { code: "zh", label: "Chinese" },
  { code: "ja", label: "Japanese" },
  { code: "ko", label: "Korean" },
  { code: "id", label: "Indonesian" },
  { code: "ms", label: "Malay" },
  { code: "fil", label: "Filipino" },
  { code: "vi", label: "Vietnamese" },
] as const;

export const VOICE_LANGUAGE_CODES = VOICE_LANGUAGES.map((l) => l.code) as unknown as [string, ...string[]];

/** Speed range accepted by ElevenLabs TTS Turbo v2.5. */
export const VOICE_SPEED_MIN = 0.7;
export const VOICE_SPEED_MAX = 1.2;

export const voiceInputSchema = z.object({
  text: z.string().trim().min(1).max(5000),
  language: z.enum(VOICE_LANGUAGE_CODES).default("en"),
  /** Mandatory since 2026-09-22 — drives the delivery; the spoken text is never rewritten (§9.6). */
  instructions: z.string().trim().min(1).max(300),
  stability: z.number().min(0).max(1).default(0.5),
  similarity_boost: z.number().min(0).max(1).default(0.75),
  style: z.number().min(0).max(1).default(0),
  speed: z.number().min(VOICE_SPEED_MIN).max(VOICE_SPEED_MAX).default(1),
});

export const JOB_INPUT_SCHEMAS = {
  model_3d: model3dInputSchema,
  audio_sfx: sfxInputSchema,
  audio_music: musicInputSchema,
  audio_voice: voiceInputSchema,
} as const;

export type Model3dInput = z.infer<typeof model3dInputSchema>;
export type SfxInput = z.infer<typeof sfxInputSchema>;
export type MusicInput = z.infer<typeof musicInputSchema>;
export type VoiceInput = z.infer<typeof voiceInputSchema>;
export type JobInput = Model3dInput | SfxInput | MusicInput | VoiceInput;

export const createJobSchema = z.object({
  type: z.enum(ASSET_TYPES),
  project_id: z.string().uuid(),
  input: z.record(z.string(), z.unknown()),
});

export const estimateJobSchema = createJobSchema.omit({ project_id: true }).extend({
  project_id: z.string().uuid().optional(),
});

export function parseJobInput(type: AssetType, input: unknown): JobInput {
  return JOB_INPUT_SCHEMAS[type].parse(input) as JobInput;
}
