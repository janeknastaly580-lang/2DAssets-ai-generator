import { describe, expect, it } from "vitest";
import {
  buildMusicInput,
  buildRodinInput,
  buildSfxInput,
  buildTrellisInput,
  buildTtsInput,
  estimateFalCostUsd,
  FAL_MODELS,
  falModelFor,
  llmParamsForTranslator,
  resolveLlmParams,
  rodinMeshSettings,
} from "@/lib/ai/falModels";
import { buildJsonSchema, translatePrompt, translatorOutputSchema } from "@/lib/ai/translator";
import { model3dInputSchema, musicInputSchema, sfxInputSchema, voiceInputSchema } from "@/lib/validation/jobs";

const model3d = (v: Record<string, unknown>) => model3dInputSchema.parse(v);
const PHOTO = { kind: "upload", id: "00000000-0000-4000-8000-000000000001" };

describe("fal routing (SPEC §9.7)", () => {
  it("picks the endpoint from engine and photos", () => {
    expect(falModelFor("model_3d", model3d({ prompt: "chest" })).endpoint).toBe(FAL_MODELS.rodinText);
    expect(falModelFor("model_3d", model3d({ images: [PHOTO] })).endpoint).toBe(FAL_MODELS.rodinImage);
    expect(falModelFor("model_3d", model3d({ engine: "trellis", images: [PHOTO] })).endpoint).toBe(FAL_MODELS.trellis);
    expect(falModelFor("audio_sfx", sfxInputSchema.parse({ prompt: "whoosh" })).endpoint).toBe(FAL_MODELS.sfx);
    expect(falModelFor("audio_music", musicInputSchema.parse({ prompt: "town theme" })).endpoint).toBe(FAL_MODELS.music);
    expect(falModelFor("audio_voice", voiceInputSchema.parse({ text: "Hi", instructions: "calm" })).endpoint).toBe(FAL_MODELS.tts);
  });
  it("hands the translator only non-UI params", () => {
    const keys = llmParamsForTranslator(falModelFor("model_3d", model3d({ prompt: "x" }))).map((p) => p.key);
    expect(keys).toEqual(["TAPose", "enable_creative_mode", "texture_delight", "texture_mode", "bbox_condition"]);
    expect(llmParamsForTranslator(falModelFor("audio_sfx", sfxInputSchema.parse({ prompt: "x" })))).toEqual([]);
    const tts = llmParamsForTranslator(falModelFor("audio_voice", voiceInputSchema.parse({ text: "a", instructions: "b" })));
    expect(tts.map((p) => p.key)).toEqual(["voice", "apply_text_normalization"]);
  });
});

describe("LLM-chosen params", () => {
  it("drops unknown keys and invalid values (provider default applies)", () => {
    const specs = falModelFor("model_3d", model3d({ prompt: "x" })).llmParams;
    expect(resolveLlmParams(specs, { TAPose: "yes", texture_delight: true, tier: "Gen-2.5-Extreme-High", bbox_condition: { width: 0, height: 1, length: 1 } })).toEqual({
      texture_delight: true,
    });
    expect(resolveLlmParams(specs, undefined)).toEqual({});
  });
});

describe("Rodin input", () => {
  it("maps Quality/Polycount/Topology to tier + mesh option", () => {
    expect(rodinMeshSettings({ quality: "standard", target_polycount: 20000, topology: "triangle" })).toEqual({ tier: "Gen-2.5-Medium", quality_mesh_option: "20K Triangle" });
    expect(rodinMeshSettings({ quality: "fast", target_polycount: 100000, topology: "quad" })).toEqual({ tier: "Gen-2.5-Low", quality_mesh_option: "100K Quad" });
    expect(rodinMeshSettings({ quality: "fast", target_polycount: 5000, topology: "quad" })).toEqual({ tier: "Gen-2.5-Low", quality_mesh_option: "4K Quad" });
    // High tiers need 20K+ triangles: the polycount budget wins, the tier drops to Medium
    expect(rodinMeshSettings({ quality: "high", target_polycount: 1000, topology: "triangle" })).toEqual({ tier: "Gen-2.5-Medium", quality_mesh_option: "2K Triangle" });
    expect(rodinMeshSettings({ quality: "high", target_polycount: 100000, topology: "triangle" })).toEqual({ tier: "Gen-2.5-High", quality_mesh_option: "50K Triangle" });
  });
  it("lets manual settings win over the LLM and adds the fixed plumbing", () => {
    const ui = model3d({ prompt: "knight", rig: true, pbr: false, quality: "high", texture_resolution: "4K" });
    const input = buildRodinInput(ui, { prompt: "a knight", model_params: { TAPose: false, enable_creative_mode: true } });
    expect(input).toMatchObject({
      prompt: "a knight",
      TAPose: true,
      enable_creative_mode: true,
      material: "Shaded",
      hd_texture: true,
      addons: { high_pack: true },
      geometry_file_format: "glb",
    });
    expect(input).not.toHaveProperty("image_urls");
  });
  it("image mode sends the uploaded photos, alpha flag and preview render; clips the prompt", () => {
    const input = buildRodinInput(model3d({ images: [PHOTO] }), { prompt: "x".repeat(2000) }, { urls: ["https://fal.media/a.png"], hasTransparency: true });
    expect(input).toMatchObject({ image_urls: ["https://fal.media/a.png"], use_original_alpha: true, preview_render: true });
    expect((input.prompt as string).length).toBe(1024);
  });
});

describe("TRELLIS input", () => {
  it("maps Quality → steps, Polycount → simplify, Texture → size", () => {
    const ui = model3d({ engine: "trellis", images: [PHOTO], quality: "high", target_polycount: 1000, texture_resolution: "1K" });
    expect(buildTrellisInput(ui, { prompt: "", model_params: { ss_guidance_strength: 9, slat_guidance_strength: 42 } }, "https://fal.media/p.png")).toEqual({
      ss_guidance_strength: 9,
      image_url: "https://fal.media/p.png",
      ss_sampling_steps: 30,
      slat_sampling_steps: 30,
      texture_size: 1024,
      mesh_simplify: 0.98,
    });
  });
  it("is photo-only, triangles only, up to 2K", () => {
    expect(model3dInputSchema.safeParse({ engine: "trellis", prompt: "chest" }).success).toBe(false);
    expect(model3dInputSchema.safeParse({ engine: "trellis", images: [PHOTO, { ...PHOTO, id: "00000000-0000-4000-8000-000000000002" }] }).success).toBe(false);
    expect(model3dInputSchema.safeParse({ engine: "trellis", images: [PHOTO], topology: "quad" }).success).toBe(false);
    expect(model3dInputSchema.safeParse({ engine: "trellis", images: [PHOTO], texture_resolution: "4K" }).success).toBe(false);
    expect(model3dInputSchema.safeParse({ engine: "trellis", images: [PHOTO] }).success).toBe(true);
  });
});

describe("audio inputs", () => {
  it("SFX: UI fields + raw PCM output", () => {
    const input = buildSfxInput(sfxInputSchema.parse({ prompt: "door knock", duration_s: 2, loop: true, prompt_influence: 0.7 }), { prompt: "wooden door knock" });
    expect(input).toEqual({ text: "wooden door knock", duration_seconds: 2, loop: true, prompt_influence: 0.7, output_format: "pcm_44100" });
    expect(buildSfxInput(sfxInputSchema.parse({ prompt: "x" }), { prompt: "x" })).not.toHaveProperty("duration_seconds");
  });
  it("Music: form fields are appended to the Lyria prompt", () => {
    const ui = musicInputSchema.parse({ prompt: "town theme", duration_s: 60, bpm: 110, key: "A minor", instrumental: true, loopable: true, provider: "eleven" });
    expect(ui).not.toHaveProperty("provider");
    const { prompt } = buildMusicInput(ui, { prompt: "Cozy chiptune town theme" }) as { prompt: string };
    expect(prompt).toContain("Cozy chiptune town theme");
    expect(prompt).toContain("about 60 seconds");
    expect(prompt).toContain("110 BPM");
    expect(prompt).toContain("Key: A minor");
    expect(prompt).toContain("Instrumental only");
    expect(prompt).toContain("loop");
  });
  it("TTS: manual sliders + language, LLM voice, text untouched", () => {
    const ui = voiceInputSchema.parse({ text: "Welcome", instructions: "old wizard", language: "pl", stability: 0.2, speed: 1.1 });
    expect(buildTtsInput(ui, { prompt: "raspy old man", model_params: { voice: "Bill", apply_text_normalization: "nope" } }, "Welcome, traveler.")).toEqual({
      voice: "Bill",
      text: "Welcome, traveler.",
      language_code: "pl",
      stability: 0.2,
      similarity_boost: 0.75,
      style: 0,
      speed: 1.1,
    });
    expect(voiceInputSchema.safeParse({ text: "a", instructions: "b", speed: 1.5 }).success).toBe(false);
    expect(voiceInputSchema.parse({ text: "a", instructions: "b", model: "eleven_v3" })).not.toHaveProperty("model");
  });
});

describe("cost estimate (fal list prices)", () => {
  it("per endpoint", () => {
    expect(estimateFalCostUsd(FAL_MODELS.rodinText, {})).toBe(0.4);
    expect(estimateFalCostUsd(FAL_MODELS.trellis, {})).toBe(0.02);
    expect(estimateFalCostUsd(FAL_MODELS.sfx, { duration_seconds: 10 })).toBeCloseTo(0.02);
    expect(estimateFalCostUsd(FAL_MODELS.music, {})).toBe(0.08);
    expect(estimateFalCostUsd(FAL_MODELS.tts, { text: "x".repeat(1000) })).toBeCloseTo(0.05);
  });
});

describe("translator contract (SPEC §8.3)", () => {
  it("model_params defaults to {} and the JSON schema requires every spec key as nullable", () => {
    expect(translatorOutputSchema.parse({ prompt: "", negative_prompt: null, notes_dropped: [] }).model_params).toEqual({});
    const spec = llmParamsForTranslator(falModelFor("audio_voice", voiceInputSchema.parse({ text: "a", instructions: "b" })));
    const schema = buildJsonSchema(spec) as { properties: { model_params: { required: string[]; properties: Record<string, { anyOf: unknown[] }> } } };
    expect(schema.properties.model_params.required).toEqual(["voice", "apply_text_normalization"]);
    expect(schema.properties.model_params.properties.voice.anyOf).toContainEqual({ type: "null" });
  });
  it("without an LLM the translation is the identity and no model_params are set", async () => {
    const { output, model } = await translatePrompt({
      asset_type: "model_3d",
      target_model: FAL_MODELS.rodinImage,
      user_prompt: "",
      project_style_guide: { art_style: "low poly" },
      params: {},
    });
    expect(model).toBe("mock-translator");
    expect(output.prompt).toBe("low poly");
    expect(output.model_params).toEqual({});
  });
});
