import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";
import { readJson, relayProviderWebhook } from "@/lib/webhooks";

/**
 * POST /api/webhooks/fal — fal.ai queue webhook. fal signs requests with ED25519 (X-Fal-Webhook-*
 * headers); we additionally require our own secret in the URL (`?secret=`) which is what the
 * pipeline passes as webhookUrl. Payload is relayed only — pipelines poll for the result (SPEC §16.7).
 */
export async function POST(req: NextRequest) {
  if (env.FAL_WEBHOOK_SECRET && req.nextUrl.searchParams.get("secret") !== env.FAL_WEBHOOK_SECRET) {
    return NextResponse.json({ ok: false, error: { code: "forbidden" } }, { status: 403 });
  }
  const { json } = await readJson(req);
  return relayProviderWebhook("fal", json);
}
