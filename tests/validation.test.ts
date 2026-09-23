import { describe, expect, it } from "vitest";
import { signupSchema, passwordSchema } from "@/lib/validation/auth";
import { ASSET_TYPES, model3dInputSchema, sfxInputSchema, voiceInputSchema } from "@/lib/validation/jobs";
import { styleGuideSchema } from "@/lib/validation/project";
import { translatorOutputSchema } from "@/lib/ai/translator";
import { moderationResultSchema } from "@/lib/ai/moderation";

describe("auth validation (SPEC §5.1)", () => {
  it("requires 10+ chars with a letter and a digit", () => {
    expect(passwordSchema.safeParse("short1").success).toBe(false);
    expect(passwordSchema.safeParse("onlyletters!!").success).toBe(false);
    expect(passwordSchema.safeParse("1234567890").success).toBe(false);
    expect(passwordSchema.safeParse("correct-horse-42").success).toBe(true);
  });
  it("requires ToS acceptance and lowercases e-mail", () => {
    const bad = signupSchema.safeParse({ email: "A@B.co", password: "correct-horse-42", accept_tos: false });
    expect(bad.success).toBe(false);
    const ok = signupSchema.safeParse({ email: "A@B.co", password: "correct-horse-42", accept_tos: true });
    expect(ok.success && ok.data.email).toBe("a@b.co");
  });
});

describe("job inputs (SPEC §9)", () => {
  it("no longer offers the retired image and animation generators", () => {
    expect(ASSET_TYPES).toEqual(["model_3d", "audio_sfx", "audio_music", "audio_voice"]);
  });
  it("applies 3D defaults", () => {
    const r = model3dInputSchema.parse({ prompt: "treasure chest" });
    expect(r.target_polycount).toBe(20000);
    expect(r.pbr).toBe(true);
  });
  it("rejects too-long SFX prompts", () => {
    expect(sfxInputSchema.safeParse({ prompt: "x".repeat(451) }).success).toBe(false);
    expect(sfxInputSchema.safeParse({ prompt: "sword swing" }).success).toBe(true);
  });
  it("voice text limit 5000", () => {
    expect(voiceInputSchema.safeParse({ text: "x".repeat(5001) }).success).toBe(false);
  });
});

describe("style guide & AI contracts", () => {
  it("validates palette hex and limits", () => {
    expect(styleGuideSchema.safeParse({ palette: ["#12345"] }).success).toBe(false);
    expect(styleGuideSchema.safeParse({ palette: ["#123456"], palette_locked: true, pixel_grid: 32 }).success).toBe(true);
  });
  it("translator output must carry empty notes_dropped to be accepted by the pipeline", () => {
    const out = translatorOutputSchema.parse({ prompt: "x", negative_prompt: null, notes_dropped: [] });
    expect(out.notes_dropped).toEqual([]);
  });
  it("moderation verdict schema", () => {
    expect(moderationResultSchema.safeParse({ verdict: "block", category: "csam", reason: "r" }).success).toBe(true);
    expect(moderationResultSchema.safeParse({ verdict: "maybe", category: null, reason: null }).success).toBe(false);
  });
});
