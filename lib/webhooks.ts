import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { inngest } from "@/inngest/client";
import { integrations } from "@/lib/env";

/** Shared relay for provider webhooks (SPEC §16.7): verify → emit `provider/webhook.received`. */
export async function relayProviderWebhook(provider: "fal" | "worker", payload: Record<string, unknown>) {
  if (integrations.inngest || process.env.INNGEST_DEV === "1") {
    await inngest.send({ name: "provider/webhook.received", data: { provider, payload } }).catch((e) => console.warn("[webhook relay]", e.message));
  } else {
    console.info(`[webhook:${provider}] received (polling mode)`, Object.keys(payload));
  }
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
