import type { NextRequest } from "next/server";
import { handler, ok, requireUser } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getCurrentWorkspace } from "@/lib/workspace";
import { getBalance } from "@/lib/credits/ledger";
import { planFor, CREDIT_PACKS, PLANS } from "@/lib/plans";
import { integrations } from "@/lib/env";

/** GET /api/billing/summary — plan, balances, period, ledger page, 30-day usage (SPEC §16.4, §17.4). */
export const GET = handler(async (req: NextRequest) => {
  const { userId, profile } = await requireUser();
  const { workspace, role } = await getCurrentWorkspace(userId);
  const db = supabaseAdmin();
  const page = Math.max(0, Number(req.nextUrl.searchParams.get("page") ?? 0));
  const pageSize = 25;
  const [balance, { data: ledger, count }, { data: usage }] = await Promise.all([
    getBalance(workspace.id),
    db
      .from("credit_ledger")
      .select("*", { count: "exact" })
      .eq("workspace_id", workspace.id)
      .order("created_at", { ascending: false })
      .range(page * pageSize, page * pageSize + pageSize - 1),
    db
      .from("credit_ledger")
      .select("delta, created_at")
      .eq("workspace_id", workspace.id)
      .eq("kind", "settlement")
      .gte("created_at", new Date(Date.now() - 30 * 86_400_000).toISOString()),
  ]);
  const byDay: Record<string, number> = {};
  for (const u of usage ?? []) {
    const d = u.created_at.slice(0, 10);
    byDay[d] = (byDay[d] ?? 0) + Math.abs(u.delta);
  }
  const plan = planFor(workspace.plan);
  return ok({
    workspace: {
      id: workspace.id,
      name: workspace.name,
      type: workspace.type,
      plan: workspace.plan,
      subscription_status: workspace.subscription_status,
      current_period_end: workspace.current_period_end,
      cancel_at_period_end: workspace.cancel_at_period_end,
      storage_used_bytes: workspace.storage_used_bytes,
      storage_quota_bytes: workspace.storage_quota_bytes,
      grace_until: workspace.grace_until,
    },
    role,
    plan_pool: plan.credits,
    balance,
    trial_available_to_buy: !profile.trial_used_at && workspace.type === "personal",
    plans: PLANS,
    packs: CREDIT_PACKS,
    billing_configured: integrations.stripe,
    ledger: ledger ?? [],
    ledger_total: count ?? 0,
    page,
    page_size: pageSize,
    usage_30d: Object.entries(byDay)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([day, credits]) => ({ day, credits })),
  });
});
