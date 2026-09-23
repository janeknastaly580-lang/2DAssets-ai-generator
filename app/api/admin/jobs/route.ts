import type { NextRequest } from "next/server";
import { handler, ok, requireAdmin } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabase/admin";

/** GET /api/admin/jobs?status=&provider=&type=&workspace=&page= — full job rows (SPEC §19 Jobs). */
export const GET = handler(async (req: NextRequest) => {
  await requireAdmin();
  const sp = req.nextUrl.searchParams;
  const page = Math.max(0, Number(sp.get("page") ?? 0));
  const size = 50;
  let q = supabaseAdmin()
    .from("jobs")
    .select("id, workspace_id, user_id, type, status, provider, provider_model, credits_estimated, credits_charged, provider_cost_usd, error_code, created_at, finished_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(page * size, page * size + size - 1);
  for (const k of ["status", "provider", "type"] as const) {
    const v = sp.get(k);
    if (v) q = q.eq(k, v as never);
  }
  const ws = sp.get("workspace");
  if (ws) q = q.eq("workspace_id", ws);
  const { data, count, error } = await q;
  if (error) throw error;
  return ok({ jobs: data ?? [], total: count ?? 0, page, page_size: size });
});
