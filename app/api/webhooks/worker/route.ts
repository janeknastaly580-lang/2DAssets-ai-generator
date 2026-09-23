import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";
import { hmacMatches, readJson, relayProviderWebhook } from "@/lib/webhooks";

/** POST /api/webhooks/worker — Modal worker completion, HMAC-SHA256 over the raw body (SPEC §14.2). */
export async function POST(req: NextRequest) {
  const { raw, json } = await readJson(req);
  if (!hmacMatches(env.WORKER_WEBHOOK_SECRET, raw, req.headers.get("x-veyraflow-signature"))) {
    return NextResponse.json({ ok: false, error: { code: "forbidden" } }, { status: 403 });
  }
  return relayProviderWebhook("worker", json);
}
