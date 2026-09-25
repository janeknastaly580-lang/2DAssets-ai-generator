import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Provider webhooks (SPEC §16.7) are acknowledged and logged only: pipelines poll the provider and
 * checkpoint the result themselves, so the payload (which carries output file URLs) goes nowhere.
 */
export async function acknowledgeProviderWebhook(provider: "fal" | "worker", payload: Record<string, unknown>) {
  const id = payload.request_id ?? payload.task_id ?? payload.id;
  console.info(`[webhook:${provider}] received`, typeof id === "string" ? id : "(no id)");
  return NextResponse.json({ ok: true });
}

export function hmacMatches(secret: string, body: string, provided: string | null): boolean {
  if (!secret || !provided) return false;
  const expected = createHmac("sha256", secret).update(body).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(provided.replace(/^sha256=/, ""));
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function readJson(req: NextRequest): Promise<{ raw: string; json: Record<string, unknown> }> {
  const raw = await req.text();
  try {
    return { raw, json: JSON.parse(raw) as Record<string, unknown> };
  } catch {
    return { raw, json: {} };
  }
}
