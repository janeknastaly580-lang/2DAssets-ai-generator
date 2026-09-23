import { handler, ok, requireAdmin } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabase/admin";

/** GET /api/admin/overview — headline numbers (SPEC §19 Overview). */
export const GET = handler(async () => {
  await requireAdmin();
  const db = supabaseAdmin();
  const day = new Date(Date.now() - 86_400_000).toISOString();
  const month = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const [
    { count: users },
    { count: subs },
    { data: jobs24 },
    { data: jobs30 },
    { data: usage24 },
    { data: usage30 },
    { data: recentJobs },
  ] = await Promise.all([
    db.from("profiles").select("id", { count: "exact", head: true }),
    db.from("workspaces").select("id", { count: "exact", head: true }).eq("subscription_status", "active"),
    db.from("jobs").select("status, provider_cost_usd, credits_charged").gte("created_at", day),
    db.from("jobs").select("status, provider_cost_usd, credits_charged, created_at").gte("created_at", month),
    db.from("credit_ledger").select("delta").eq("kind", "settlement").gte("created_at", day),
    db.from("credit_ledger").select("delta").eq("kind", "settlement").gte("created_at", month),
    db.from("jobs").select("id, type, status, created_at, credits_estimated, error_code").order("created_at", { ascending: false }).limit(10),
  ]);
  const byStatus: Record<string, number> = {};
  for (const j of jobs24 ?? []) byStatus[j.status] = (byStatus[j.status] ?? 0) + 1;
  const cost24 = (jobs24 ?? []).reduce((s, j) => s + Number(j.provider_cost_usd ?? 0), 0);
  const cost30 = (jobs30 ?? []).reduce((s, j) => s + Number(j.provider_cost_usd ?? 0), 0);
  const credits24 = (usage24 ?? []).reduce((s, l) => s + Math.abs(l.delta), 0);
  const credits30 = (usage30 ?? []).reduce((s, l) => s + Math.abs(l.delta), 0);
  const perDay: Record<string, { jobs: number; credits: number; cost: number }> = {};
  for (const j of jobs30 ?? []) {
    const d = j.created_at.slice(0, 10);
    const e = (perDay[d] ??= { jobs: 0, credits: 0, cost: 0 });
    e.jobs++;
    e.credits += j.credits_charged ?? 0;
    e.cost += Number(j.provider_cost_usd ?? 0);
  }
  return ok({
    users: users ?? 0,
    active_subscriptions: subs ?? 0,
    jobs_24h: byStatus,
    credits_used_24h: credits24,
    credits_used_30d: credits30,
    provider_cost_24h: Number(cost24.toFixed(4)),
    provider_cost_30d: Number(cost30.toFixed(4)),
    estimated_gross_margin_30d: credits30 ? Number((((credits30 * 0.01 - cost30) / (credits30 * 0.01)) * 100).toFixed(1)) : null,
    series_30d: Object.entries(perDay).sort(([a], [b]) => a.localeCompare(b)).map(([day, v]) => ({ day, ...v, cost: Number(v.cost.toFixed(4)) })),
    recent_jobs: recentJobs ?? [],
  });
});
