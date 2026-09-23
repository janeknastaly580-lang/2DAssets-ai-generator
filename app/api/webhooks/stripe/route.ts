import { NextResponse, type NextRequest } from "next/server";
import { env, integrations } from "@/lib/env";
import { stripe } from "@/lib/billing/stripe";
import { handleStripeEvent } from "@/lib/billing/webhook";

export const runtime = "nodejs";

/** POST /api/webhooks/stripe — signature verified, idempotent via stripe_events (SPEC §11.6, §16.7). */
export async function POST(req: NextRequest) {
  if (!integrations.stripe || !env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ ok: false, error: { code: "not_configured" } }, { status: 503 });
  }
  const sig = req.headers.get("stripe-signature");
  if (!sig) return NextResponse.json({ ok: false, error: { code: "missing_signature" } }, { status: 400 });
  const raw = await req.text();
  let event;
  try {
    event = stripe().webhooks.constructEvent(raw, sig, env.STRIPE_WEBHOOK_SECRET);
  } catch (e) {
    return NextResponse.json({ ok: false, error: { code: "bad_signature", message: (e as Error).message } }, { status: 400 });
  }
  if (Date.now() / 1000 - event.created > 5 * 60 && process.env.NODE_ENV === "production") {
    return NextResponse.json({ ok: false, error: { code: "stale_event" } }, { status: 400 });
  }
  try {
    await handleStripeEvent(event);
  } catch (e) {
    console.error("[stripe webhook]", e);
    return NextResponse.json({ ok: false, error: { code: "handler_error" } }, { status: 500 });
  }
  return NextResponse.json({ ok: true, received: event.id });
}
