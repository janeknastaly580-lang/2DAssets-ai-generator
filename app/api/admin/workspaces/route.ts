import type { NextRequest } from "next/server";
import { handler, ok, requireAdmin } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabase/admin";

/** GET /api/admin/workspaces?q=&page= — plan, Stripe status, storage, members (SPEC §19 Workspaces). */
export const GET = handler(async (req: NextRequest) => {
  await requireAdmin();
  const sp = req.nextUrl.searchParams;
  const page = Math.max(0, Number(sp.get("page") ?? 0));
  const size = 50;
  let q = supabaseAdmin()
    .from("workspaces")
    .select("*, credit_balances(*), workspace_members(count), profiles!workspaces_owner_id_fkey(email)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(page * size, page * size + size - 1);
  const text = sp.get("q");
  if (text) q = q.or(`name.ilike.%${text.replace(/[%,]/g, "")}%,slug.ilike.%${text.replace(/[%,]/g, "")}%`);
  const { data, count, error } = await q;
  if (error) throw error;
  return ok({
    workspaces: (data ?? []).map((w) => ({
      ...w,
      member_count: (w.workspace_members as unknown as { count: number }[])?.[0]?.count ?? 0,
      owner_email: (w.profiles as unknown as { email: string } | null)?.email ?? null,
      workspace_members: undefined,
      profiles: undefined,
    })),
    total: count ?? 0,
    page,
    page_size: size,
  });
});
