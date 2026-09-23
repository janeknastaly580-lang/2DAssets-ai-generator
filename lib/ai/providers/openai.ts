import "server-only";
import { env } from "@/lib/env";

/**
 * Minimal OpenAI Chat Completions client (fetch only, no SDK). Used by the prompt translator
 * (§8.3) and the moderation filter (§12.1). User text is always passed as a `user` message,
 * never inside the system prompt (§22 prompt-injection rule).
 */
export interface JsonCompletionOptions {
  model: string;
  system: string;
  user: string;
  schemaName: string;
  schema: Record<string, unknown>;
  temperature?: number;
  maxTokens?: number;
}

export async function openaiJsonCompletion<T>(opts: JsonCompletionOptions): Promise<T> {
  if (!env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not configured");
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${env.OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: opts.model,
      temperature: opts.temperature ?? 0,
      max_completion_tokens: opts.maxTokens ?? 800,
      messages: [
        { role: "system", content: opts.system },
        { role: "user", content: opts.user },
      ],
      response_format: {
        type: "json_schema",
        json_schema: { name: opts.schemaName, strict: true, schema: opts.schema },
      },
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`OpenAI ${res.status}: ${text.slice(0, 300)}`);
  }
  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const content = json.choices?.[0]?.message?.content;
  if (!content) throw new Error("OpenAI returned an empty response");
  return JSON.parse(content) as T;
}
