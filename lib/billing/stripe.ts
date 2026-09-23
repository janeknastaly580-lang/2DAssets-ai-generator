import "server-only";
import Stripe from "stripe";
import { env, integrations } from "@/lib/env";
import { ApiError } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { CheckoutKind } from "@/lib/plans";
import type { Database } from "@/lib/supabase/database.types";

type Workspace = Database["public"]["Tables"]["workspaces"]["Row"];

let client: Stripe | null = null;

export function stripe(): Stripe {
  if (!integrations.stripe) throw new ApiError("billing_not_configured", "Billing is not configured yet (STRIPE_SECRET_KEY missing)", 503);
  if (!client) client = new Stripe(env.STRIPE_SECRET_KEY, { typescript: true });
  return client;
}

export function priceFor(kind: CheckoutKind): string {
  const id = env.STRIPE_PRICES[kind];
  if (!id) throw new ApiError("billing_not_configured", `Stripe price for "${kind}" is not configured`, 503);
  return id;
}

/** Ensures a Stripe customer exists for the workspace (SPEC §11.6). */
export async function ensureCustomer(ws: Workspace, email: string): Promise<string> {
  if (ws.stripe_customer_id) return ws.stripe_customer_id;
  const customer = await stripe().customers.create({
    email,
    name: ws.name,
    metadata: { workspace_id: ws.id, workspace_type: ws.type },
  });
  await supabaseAdmin().from("workspaces").update({ stripe_customer_id: customer.id }).eq("id", ws.id);
  return customer.id;
}

/**
 * Hosted Stripe Checkout (SPEC §11.5/§11.6/§23.4). No card data ever touches the app.
 */
export async function createCheckoutSession(opts: {
  workspace: Workspace;
  userId: string;
  email: string;
  kind: CheckoutKind;
  trialUsed: boolean;
}): Promise<string> {
  const { workspace, kind } = opts;
  if (kind === "trial" && opts.trialUsed) throw new ApiError("trial_used", "The trial can only be purchased once per account", 400);
  if (kind === "trial" && workspace.type === "team") throw new ApiError("invalid", "Trial is only available on personal workspaces", 400);
  if ((kind === "pro" || kind === "studio") && workspace.subscription_status === "active") {
    throw new ApiError("already_subscribed", "Use “Manage subscription” to change your plan", 400);
  }
  if (kind === "pro" && workspace.type === "team") throw new ApiError("invalid", "Team workspaces require the Studio plan", 400);

  const customer = await ensureCustomer(workspace, opts.email);
  const isSubscription = kind === "pro" || kind === "studio";
  const session = await stripe().checkout.sessions.create({
    mode: isSubscription ? "subscription" : "payment",
    ui_mode: "hosted",
    customer,
    client_reference_id: workspace.id,
    line_items: [{ price: priceFor(kind), quantity: 1 }],
    success_url: `${env.APP_URL}/app/billing?status=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${env.APP_URL}/app/billing`,
    automatic_tax: { enabled: true },
    billing_address_collection: "required",
    tax_id_collection: { enabled: true },
    customer_update: { address: "auto", name: "auto" },
    allow_promotion_codes: true,
    metadata: { workspace_id: workspace.id, user_id: opts.userId, kind },
    ...(isSubscription ? { subscription_data: { metadata: { workspace_id: workspace.id, kind } } } : {}),
  });
  if (!session.url) throw new ApiError("stripe_error", "Stripe did not return a checkout URL", 502);
  return session.url;
}

export async function createPortalSession(workspace: Workspace, email: string): Promise<string> {
  const customer = await ensureCustomer(workspace, email);
  const session = await stripe().billingPortal.sessions.create({ customer, return_url: `${env.APP_URL}/app/billing` });
  return session.url;
}
