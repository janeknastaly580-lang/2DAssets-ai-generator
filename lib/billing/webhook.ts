import "server-only";
import type Stripe from "stripe";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { grantCredits, resetSubscriptionCredits, expireCredits } from "@/lib/credits/ledger";
import { PLANS, RETENTION_GRACE_DAYS, SUBSCRIPTION_GRACE_DAYS, TRIAL_DAYS, type PlanTier } from "@/lib/plans";
import { env } from "@/lib/env";
import { stripe } from "./stripe";

/**
 * Stripe webhook handlers (SPEC §11.6). Idempotent via `stripe_events` and ledger refs.
 * Monthly cycle: `invoice.paid` resets the subscription bucket to the plan pool (unused credits lapse).
 */
export async function handleStripeEvent(event: Stripe.Event): Promise<void> {
  const db = supabaseAdmin();
  const { data: existing } = await db.from("stripe_events").select("id, processed_at").eq("id", event.id).maybeSingle();
  if (existing?.processed_at) return;
  if (!existing) {
    await db.from("stripe_events").insert({ id: event.id, type: event.type, payload: event as never });
  }
  try {
    switch (event.type) {
      case "checkout.session.completed":
        await onCheckoutCompleted(event.data.object);
        break;
      case "invoice.paid":
        await onInvoicePaid(event.data.object);
        break;
      case "customer.subscription.updated":
        await onSubscriptionUpdated(event.data.object);
        break;
      case "customer.subscription.deleted":
        await onSubscriptionDeleted(event.data.object);
        break;
      case "invoice.payment_failed":
        await onPaymentFailed(event.data.object);
        break;
      default:
        break;
    }
    await db.from("stripe_events").update({ processed_at: new Date().toISOString() }).eq("id", event.id);
  } catch (e) {
    await db.from("stripe_events").update({ error: (e as Error).message.slice(0, 500) }).eq("id", event.id);
    throw e;
  }
}

async function workspaceByCustomer(customerId: string | null | undefined) {
  if (!customerId) return null;
  const { data } = await supabaseAdmin().from("workspaces").select("*").eq("stripe_customer_id", customerId).maybeSingle();
  return data;
}

function planFromPrice(priceId: string | undefined): PlanTier | null {
  if (!priceId) return null;
  if (priceId === env.STRIPE_PRICES.pro) return "pro";
  if (priceId === env.STRIPE_PRICES.studio) return "studio";
  return null;
}

async function onCheckoutCompleted(session: Stripe.Checkout.Session) {
  const db = supabaseAdmin();
  const wsId = (session.metadata?.workspace_id ?? session.client_reference_id) as string | undefined;
  const kind = session.metadata?.kind as string | undefined;
  const userId = session.metadata?.user_id as string | undefined;
  if (!wsId) return;
  const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id;
  if (customerId) await db.from("workspaces").update({ stripe_customer_id: customerId }).eq("id", wsId);

  if (session.mode === "payment") {
    if (kind === "trial") {
      const granted = await grantCredits({
        workspaceId: wsId,
        bucket: "trial",
        amount: env.TRIAL_CREDITS,
        kind: "trial_purchase",
        ref: session.id,
        expiresAt: new Date(Date.now() + TRIAL_DAYS * 86_400_000),
        actorId: userId ?? null,
        description: "Trial purchase",
      });
      if (granted) {
        await db
          .from("workspaces")
          .update({ plan: "trial", storage_quota_bytes: PLANS.trial.storageBytes, retention_days: PLANS.trial.retentionDays })
          .eq("id", wsId)
          .eq("plan", "none");
        if (userId) await db.from("profiles").update({ trial_used_at: new Date().toISOString() }).eq("id", userId);
      }
    } else if (kind === "pack_1000" || kind === "pack_10000") {
      const amount = kind === "pack_1000" ? 1000 : 10000;
      await grantCredits({ workspaceId: wsId, bucket: "purchased", amount, kind: "pack_purchase", ref: session.id, actorId: userId ?? null, description: `Credit ${kind}` });
    }
  } else if (session.mode === "subscription") {
    const subId = typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
    if (subId) {
      const sub = await stripe().subscriptions.retrieve(subId);
      await syncSubscription(wsId, sub);
    }
  }
}

async function syncSubscription(wsId: string, sub: Stripe.Subscription) {
  const db = supabaseAdmin();
  const priceId = sub.items.data[0]?.price?.id;
  const plan = planFromPrice(priceId);
  const status = (["active", "past_due", "canceled", "unpaid", "incomplete"].includes(sub.status) ? sub.status : "none") as
    | "active" | "past_due" | "canceled" | "unpaid" | "incomplete" | "none";
  const item = sub.items.data[0];
  const periodStart = item?.current_period_start ? new Date(item.current_period_start * 1000).toISOString() : null;
  const periodEnd = item?.current_period_end ? new Date(item.current_period_end * 1000).toISOString() : null;
  const cfg = plan ? PLANS[plan] : null;
  await db
    .from("workspaces")
    .update({
      stripe_subscription_id: sub.id,
      subscription_status: status,
      current_period_start: periodStart,
      current_period_end: periodEnd,
      cancel_at_period_end: Boolean(sub.cancel_at_period_end),
      ...(plan && status !== "canceled"
        ? { plan, storage_quota_bytes: cfg!.storageBytes, retention_days: cfg!.retentionDays, seats: cfg!.seats, grace_until: null }
        : {}),
    })
    .eq("id", wsId);
  if (plan && status === "active") {
    // active subscription → assets never expire while it lasts
    await db.from("assets").update({ expires_at: null }).eq("workspace_id", wsId).is("deleted_at", null);
  }
}

async function onInvoicePaid(invoice: Stripe.Invoice) {
  const reason = invoice.billing_reason;
  if (!reason || !["subscription_create", "subscription_cycle", "subscription_update"].includes(reason)) return;
  const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
  const ws = await workspaceByCustomer(customerId);
  if (!ws) return;
  const subId = invoice.parent?.subscription_details?.subscription;
  const sub = subId ? await stripe().subscriptions.retrieve(typeof subId === "string" ? subId : subId.id) : null;
  if (sub) await syncSubscription(ws.id, sub);
  const linePrice = invoice.lines.data.find((l) => l.pricing?.price_details?.price)?.pricing?.price_details?.price;
  const priceId = sub?.items.data[0]?.price?.id ?? (typeof linePrice === "string" ? linePrice : linePrice?.id) ?? undefined;
  const plan = planFromPrice(priceId) ?? (ws.plan === "pro" || ws.plan === "studio" ? ws.plan : null);
  if (!plan) return;
  const pool = PLANS[plan].credits;
  const periodEnd = sub?.items.data[0]?.current_period_end ? sub.items.data[0].current_period_end * 1000 : Date.now() + 31 * 86_400_000;
  const expiresAt = new Date(periodEnd + SUBSCRIPTION_GRACE_DAYS * 86_400_000);

  if (reason === "subscription_update") {
    // upgrade Pro → Studio mid-cycle (proration): raise by the difference, no reset; downgrade: nothing
    const { data: bal } = await supabaseAdmin().from("credit_balances").select("subscription_available").eq("workspace_id", ws.id).single();
    const prevPool = ws.plan === "pro" ? PLANS.pro.credits : ws.plan === "studio" ? PLANS.studio.credits : 0;
    const diff = pool - prevPool;
    if (diff > 0 && bal) {
      await grantCredits({ workspaceId: ws.id, bucket: "subscription", amount: diff, kind: "subscription_grant", ref: invoice.id, expiresAt, description: "Plan upgrade (prorated)" });
    }
    return;
  }
  await resetSubscriptionCredits(ws.id, pool, expiresAt, invoice.id);
}

async function onSubscriptionUpdated(sub: Stripe.Subscription) {
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer?.id;
  const ws = await workspaceByCustomer(customerId);
  if (!ws) return;
  await syncSubscription(ws.id, sub);
}

async function onSubscriptionDeleted(sub: Stripe.Subscription) {
  const db = supabaseAdmin();
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer?.id;
  const ws = await workspaceByCustomer(customerId);
  if (!ws) return;
  const grace = new Date(Date.now() + RETENTION_GRACE_DAYS * 86_400_000);
  await db
    .from("workspaces")
    .update({
      plan: "none",
      subscription_status: "canceled",
      stripe_subscription_id: null,
      cancel_at_period_end: false,
      storage_quota_bytes: PLANS.none.storageBytes,
      retention_days: PLANS.none.retentionDays,
      grace_until: grace.toISOString(),
    })
    .eq("id", ws.id);
  await expireCredits(ws.id, "subscription");
  await db.from("assets").update({ expires_at: grace.toISOString() }).eq("workspace_id", ws.id).is("deleted_at", null);
}

async function onPaymentFailed(invoice: Stripe.Invoice) {
  const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
  const ws = await workspaceByCustomer(customerId);
  if (!ws) return;
  await supabaseAdmin().from("workspaces").update({ subscription_status: "past_due" }).eq("id", ws.id);
}
