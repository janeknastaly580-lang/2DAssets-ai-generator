import type { NextRequest } from "next/server";
import { handler, ok, requireAdmin } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabase/admin";

/** GET /api/admin/costs?from&to&format=csv — aggregates per pipeline/provider/model (SPEC §19 Costs). */
export const GET = handler(async (req: NextRequest) => {
  await requireAdmin();
  const sp = req.nextUrl.searchParams;
  const to = sp.get("to") ? new Date(sp.get("to")!) : new Date();
  const from = sp.get("from") ? new Date(sp.get("from")!) : new Date(to.getTime() - 30 * 86_400_000);
  const { data, error } = await supabaseAdmin()
    .from("jobs")
    .select("type, provider, provider_model, status, credits_charged, provider_cost_usd")
    .gte("created_at", from.toISOString())
    .lte("created_at", to.toISOString())
    .eq("status", "completed");
  if (error) throw error;
  const groups = new Map<string, { pipeline: string; provider: string; model: string; jobs: number; credits: number; cost_usd: number }>();
  for (const j of data ?? []) {
    const key = `${j.type}|${j.provider ?? "-"}|${j.provider_model ?? "-"}`;
    const g = groups.get(key) ?? { pipeline: j.type, provider: j.provider ?? "-", model: j.provider_model ?? "-", jobs: 0, credits: 0, cost_usd: 0 };
    g.jobs++;
    g.credits += j.credits_charged ?? 0;
    g.cost_usd += Number(j.provider_cost_usd ?? 0);
    groups.set(key, g);
  }
  const rows = Array.from(groups.values()).map((g) => ({
    ...g,
    cost_usd: Number(g.cost_usd.toFixed(4)),
    cost_per_job: g.jobs ? Number((g.cost_usd / g.jobs).toFixed(4)) : 0,
    credits_per_job: g.jobs ? Number((g.credits / g.jobs).toFixed(2)) : 0,
    // 1 credit = 0.01 USD cost basis (SPEC §11.1)
    margin_at_cost_basis: g.credits ? Number((((g.credits * 0.01 - g.cost_usd) / (g.credits * 0.01)) * 100).toFixed(1)) : 0,
  }));
  if (sp.get("format") === "csv") {
    const header = "pipeline,provider,model,jobs,credits,cost_usd,cost_per_job,credits_per_job,margin_at_cost_basis_pct";
    const csv = [header, ...rows.map((r) => [r.pipeline, r.provider, r.model, r.jobs, r.credits, r.cost_usd, r.cost_per_job, r.credits_per_job, r.margin_at_cost_basis].join(","))].join("\n");
    return new Response(csv, { headers: { "Content-Type": "text/csv", "Content-Disposition": 'attachment; filename="veyraflow-costs.csv"' } });
  }
  return ok({ from: from.toISOString(), to: to.toISOString(), rows });
});
