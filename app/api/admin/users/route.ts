import type { NextRequest } from "next/server";
import { handler, ok, requireAdmin } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabase/admin";

/** GET /api/admin/users?q=&page= — users with personal workspace plan & balance (SPEC §19). */
export const GET = handler(async (req: NextRequest) => {
  await requireAdmin();
  const sp = req.nextUrl.searchParams;
  const page = Math.max(0, Number(sp.get("page") ?? 0));
  const size = 50;
  const db = supabaseAdmin();
  let q = db.from("profiles").select("*", { count: "exact" }).order("created_at", { ascending: false }).range(page * size, page * size + size - 1);
  const text = sp.get("q");
  if (text) q = q.or(`email.ilike.%${text.replace(/[%,]/g, "")}%,display_name.ilike.%${text.replace(/[%,]/g, "")}%`);
  const { data: users, count, error } = await q;
  if (error) throw error;
  const ids = (users ?? []).map((u) => u.id);
  const { data: wss } = ids.length
    ? await db.from("workspaces").select("id, owner_id, plan, subscription_status, credit_balances(*)").in("owner_id", ids).eq("type", "personal")
    : { data: [] };
  const byOwner = new Map((wss ?? []).map((w) => [w.owner_id, w]));
  return ok({
    users: (users ?? []).map((u) => {
      const w = byOwner.get(u.id);
      const b = (w?.credit_balances as unknown as { trial_available: number; subscription_available: number; purchased_available: number; reserved: number } | null) ?? null;
      return {
        ...u,
        personal_workspace_id: w?.id ?? null,
        plan: w?.plan ?? "none",
        subscription_status: w?.subscription_status ?? "none",
        credits: b ? b.trial_available + b.subscription_available + b.purchased_available - b.reserved : 0,
      };
    }),
    total: count ?? 0,
    page,
    page_size: size,
  });
});
