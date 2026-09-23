import "server-only";
import { z } from "zod";
import { env, integrations } from "@/lib/env";
import { openaiJsonCompletion } from "./providers/openai";
import type { StyleGuide } from "@/lib/validation/project";
import type { AssetType } from "@/lib/validation/jobs";

/**
 * Invisible prompt-translation layer (SPEC §8.3). Restates the user's intent in the form the
 * target model understands best — adds nothing, drops nothing. Versioned so calibration changes
 * are traceable in `jobs.translator_prompt_version`.
 */
export const TRANSLATOR_PROMPT_VERSION = "1.1.0";

export const translatorOutputSchema = z.object({
  /** may be empty: image-to-3D without a user prompt lets the model describe the photos itself */
  prompt: z.string(),
  negative_prompt: z.string().nullable(),
  notes_dropped: z.array(z.string()),
  /**
   * Values for the provider parameters that are not in the UI (SPEC §8.3, §9.7). Keys come from
   * `model_params_spec`; null = keep the provider default. Validated again per model in
   * lib/ai/falModels.ts, so an invalid value falls back to the provider default.
   */
  model_params: z.record(z.string(), z.unknown()).default({}),
});
export type TranslatorOutput = z.infer<typeof translatorOutputSchema>;

export interface TranslatorInput {
  asset_type: AssetType;
  target_model: string;
  user_prompt: string;
  project_style_guide: StyleGuide | Record<string, unknown> | null;
  params: Record<string, unknown>;
  /** TTS: translate only the direction/params, never the spoken text (§9.6). */
  mode?: "full" | "params_only";
  /** provider params the translator must choose (not exposed in the UI), from lib/ai/falModels.ts */
  model_params_spec?: ModelParamSpec[];
  /** model-specific constraints, e.g. prompt length limits */
  translator_notes?: string;
}

export interface ModelParamSpec {
  key: string;
  description: string;
  /** JSON Schema of a non-null value */
  schema: Record<string, unknown>;
}

// Canonical system prompt (SPEC §8.3). Keep in sync with the specification.
export function buildSystemPrompt(
  targetModel: string,
  assetType: string,
  mode: "full" | "params_only",
  extra: { hasModelParams?: boolean; notes?: string } = {},
): string {
  const base = `You are a prompt translator between a game developer and a specialized generative model (\`${targetModel}\`, producing \`${assetType}\`).
Your ONLY job is to restate the user's request in the form this model understands best (English, model-appropriate phrasing, ordering and keywords).
Rules:
1. Preserve every piece of information the user provided (subject, style, colors, perspective, mood, size, technical constraints). Do not omit anything.
2. Do NOT add anything the user did not ask for: no new objects, no extra style words, no "high quality, 8k, masterpiece" filler, no assumptions about background, lighting or details unless the user or the project style guide stated them.
3. The project style guide below was written by the user and counts as user-provided information; merge it with the request, resolving conflicts in favor of the request.
4. If the input is in a language other than English, translate it faithfully.
5. Convert only the *form*: e.g. "przezroczyste tło" → "transparent background", "make it tiny" → the size parameter, "pixelowy" → "pixel art".
6. If the model does not support a negative prompt, fold necessary exclusions into the positive phrasing only if the user asked for exclusions; otherwise leave them out.
7. Output strictly the JSON schema provided. \`notes_dropped\` must be empty; if you cannot preserve some information, put it there instead of inventing.`;
  const rules: string[] = [];
  if (mode === "params_only") {
    rules.push(
      `This is text-to-speech: the spoken text is the asset itself and is NOT part of your output. Translate only the delivery direction (emotion, pacing, character) into the \`prompt\` field.`,
    );
  }
  if (extra.hasModelParams) {
    rules.push(
      `\`model_params\`: choose a value for every parameter listed in \`model_params_spec\` — the user cannot set these in the interface. Base each choice on the user's request, the project style guide and the user's manual settings in \`params\`; the manual settings are fixed and must never be contradicted. Use null when nothing in the request gives a reason to deviate from the model default.`,
    );
  }
  if (extra.notes) rules.push(`Model notes: ${extra.notes}`);
  return rules.reduce((acc, rule, i) => `${acc}\n${8 + i}. ${rule}`, base);
}

/** Structured-output schema; `model_params` is built from the target model's spec (all keys required, each nullable). */
export function buildJsonSchema(spec: ModelParamSpec[] = []) {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      prompt: { type: "string" },
      negative_prompt: { type: ["string", "null"] },
      notes_dropped: { type: "array", items: { type: "string" } },
      model_params: {
        type: "object",
        additionalProperties: false,
        properties: Object.fromEntries(spec.map((p) => [p.key, { anyOf: [p.schema, { type: "null" }] }])),
        required: spec.map((p) => p.key),
      },
    },
    required: ["prompt", "negative_prompt", "notes_dropped", "model_params"],
  };
}

export class TranslationDroppedInfoError extends Error {
  constructor(public dropped: string[]) {
    super(`Translator could not preserve: ${dropped.join("; ")}`);
    this.name = "TranslationDroppedInfoError";
  }
}

export async function translatePrompt(input: TranslatorInput): Promise<{ output: TranslatorOutput; model: string }> {
  const mode = input.mode ?? "full";
  if (integrations.mockProviders || !env.OPENAI_API_KEY) {
    // Mock: identity translation (plus the style guide as a suffix so the flow is observable).
    // No model_params → every LLM-chosen provider parameter keeps its provider default.
    const sg = input.project_style_guide as StyleGuide | null;
    const extras = [sg?.art_style, sg?.perspective ? `${sg.perspective} view` : null, sg?.mood, sg?.style_notes];
    return {
      model: "mock-translator",
      output: {
        prompt: mode === "full" ? [input.user_prompt.trim(), ...extras].filter(Boolean).join(", ") : input.user_prompt,
        negative_prompt: null,
        notes_dropped: [],
        model_params: {},
      },
    };
  }

  const userPayload = JSON.stringify(
    {
      asset_type: input.asset_type,
      target_model: input.target_model,
      user_request: input.user_prompt,
      project_style_guide: input.project_style_guide ?? {},
      params: input.params,
      model_params_spec: input.model_params_spec ?? [],
    },
    null,
    2,
  );

  const spec = input.model_params_spec ?? [];
  const raw = await openaiJsonCompletion<unknown>({
    model: env.PROMPT_TRANSLATOR_MODEL,
    system: buildSystemPrompt(input.target_model, input.asset_type, mode, { hasModelParams: spec.length > 0, notes: input.translator_notes }),
    user: userPayload,
    schemaName: "prompt_translation",
    schema: buildJsonSchema(spec),
    temperature: 0.1,
  });
  const output = translatorOutputSchema.parse(raw);
  if (output.notes_dropped.length > 0) throw new TranslationDroppedInfoError(output.notes_dropped);
  return { output, model: env.PROMPT_TRANSLATOR_MODEL };
}
