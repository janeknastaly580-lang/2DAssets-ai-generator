import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Stripe from "stripe";
import type { NextRequest } from "next/server";

// SPEC §11.6 / §16.7 — replay protection is the signature timestamp, not `event.created`,
// so Stripe retries of old events (up to 3 days) must still be processed.
const SECRET = "whsec_test_secret";
const client = new Stripe("sk_test_dummy");
const handleStripeEvent = vi.fn(async (_event: Stripe.Event) => {});

vi.mock("@/lib/env", () => ({ env: { STRIPE_WEBHOOK_SECRET: SECRET }, integrations: { stripe: true } }));
vi.mock("@/lib/billing/stripe", () => ({ stripe: () => client }));
vi.mock("@/lib/billing/webhook", () => ({ handleStripeEvent }));
vi.mock("@/lib/errorReporting", () => ({ reportError: vi.fn() }));

const { POST } = await import("@/app/api/webhooks/stripe/route");

const now = () => Math.floor(Date.now() / 1000);

function delivery(event: object, opts: { signedAt?: number; secret?: string; body?: string } = {}) {
  const payload = JSON.stringify(event);
  const sig = client.webhooks.generateTestHeaderString({ payload, secret: opts.secret ?? SECRET, timestamp: opts.signedAt ?? now() });
  return new Request("https://veyraflow.eu/api/webhooks/stripe", {
    method: "POST",
    headers: { "stripe-signature": sig },
    body: opts.body ?? payload,
  }) as unknown as NextRequest;
}

const event = (createdSecondsAgo: number) => ({
  id: "evt_test_1",
  object: "event",
  type: "checkout.session.completed",
  created: now() - createdSecondsAgo,
  data: { object: { id: "cs_test_1", object: "checkout.session" } },
});

describe("POST /api/webhooks/stripe", () => {
  beforeEach(() => handleStripeEvent.mockClear());
  afterEach(() => vi.unstubAllEnvs());

  it("processes a retry of an event created days ago when the delivery is freshly signed (production)", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const res = await POST(delivery(event(3 * 86_400 - 60)));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, received: "evt_test_1" });
    expect(handleStripeEvent).toHaveBeenCalledOnce();
    expect(handleStripeEvent.mock.calls[0]![0].id).toBe("evt_test_1");
  });

  it("rejects a replayed delivery whose signature timestamp is outside the 300 s tolerance", async () => {
    const res = await POST(delivery(event(0), { signedAt: now() - 301 }));
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("bad_signature");
    expect(handleStripeEvent).not.toHaveBeenCalled();
  });

  it("rejects a wrong secret or a tampered body", async () => {
    const wrongSecret = await POST(delivery(event(0), { secret: "whsec_other" }));
    const tampered = await POST(delivery(event(0), { body: JSON.stringify({ ...event(0), id: "evt_forged" }) }));
    for (const res of [wrongSecret, tampered]) {
      expect(res.status).toBe(400);
      expect((await res.json()).error.code).toBe("bad_signature");
    }
    expect(handleStripeEvent).not.toHaveBeenCalled();
  });

  it("rejects a request without a signature header", async () => {
    const req = new Request("https://veyraflow.eu/api/webhooks/stripe", { method: "POST", body: "{}" }) as unknown as NextRequest;
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("missing_signature");
  });

  it("returns 500 on handler failure so Stripe retries the delivery", async () => {
    handleStripeEvent.mockRejectedValueOnce(new Error("db down"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await POST(delivery(event(0)));
    expect(res.status).toBe(500);
    expect((await res.json()).error.code).toBe("handler_error");
  });
});
