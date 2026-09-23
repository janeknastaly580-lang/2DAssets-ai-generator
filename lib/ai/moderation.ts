import "server-only";
import { z } from "zod";
import { env, integrations } from "@/lib/env";
import { openaiJsonCompletion } from "./providers/openai";

/** Prompt filter (SPEC §12.1). Versioned for traceability in `jobs.moderation_prompt_version`. */
export const MODERATION_PROMPT_VERSION = "1.0.0";

export const MODERATION_SYSTEM_PROMPT = `You are a content filter for a game asset generator. Decide whether the user's request may be sent to the generative models.
BLOCK always: nudity, sexual content, sexualized characters, requests to undress or make characters "sexy/nude/lingerie", any sexual content involving minors (also report category \`csam\`).
BLOCK only in truly drastic cases: graphic gore intended to shock (realistic mutilation, torture as the main subject), explicit drug-use instructions or glorification, real-world hate symbols or targeted hateful content against real groups, real persons in defamatory scenes.
ALLOW normal game content: fantasy/sci-fi combat, weapons, blood splatter effects, monsters, skeletons, zombies, potions, "poison", bars/taverns, horror atmosphere, villains, war games, stylized violence.
When unsure whether something is "drastic", allow it. Output JSON only.`;

export const moderationResultSchema = z.object({
  verdict: z.enum(["allow", "block"]),
  category: z.enum(["sexual_nudity", "extreme_violence", "drugs_extreme", "csam", "hate_extreme", "other"]).nullable(),
  reason: z.string().max(300).nullable(),
});
export type ModerationResult = z.infer<typeof moderationResultSchema>;

const JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    verdict: { type: "string", enum: ["allow", "block"] },
    category: {
      type: ["string", "null"],
      enum: ["sexual_nudity", "extreme_violence", "drugs_extreme", "csam", "hate_extreme", "other", null],
    },
    reason: { type: ["string", "null"] },
  },
  required: ["verdict", "category", "reason"],
};

// Mock filter — a tiny keyword list so the rejection flow can be exercised without an API key.
const MOCK_BLOCK: { re: RegExp; category: ModerationResult["category"] }[] = [
  { re: /\b(nude|naked|nudity|nsfw|sexy|lingerie|porn|erotic|undress)\b/i, category: "sexual_nudity" },
  { re: /\b(torture porn|snuff|mutilat\w+ (child|baby))\b/i, category: "extreme_violence" },
];

export async function moderatePrompt(text: string): Promise<{ result: ModerationResult; model: string }> {
  if (integrations.mockProviders || !env.OPENAI_API_KEY) {
    const hit = MOCK_BLOCK.find((m) => m.re.test(text));
    return {
      model: "mock-moderation",
      result: hit
        ? { verdict: "block", category: hit.category, reason: "Matched mock content policy keyword" }
        : { verdict: "allow", category: null, reason: null },
    };
  }
  const raw = await openaiJsonCompletion<unknown>({
    model: env.MODERATION_MODEL,
    system: MODERATION_SYSTEM_PROMPT,
    user: text,
    schemaName: "moderation_verdict",
    schema: JSON_SCHEMA,
    temperature: 0,
    maxTokens: 200,
  });
  return { result: moderationResultSchema.parse(raw), model: env.MODERATION_MODEL };
}
