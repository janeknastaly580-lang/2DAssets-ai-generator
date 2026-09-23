import type { NextRequest } from "next/server";
import { handler, ok, requireAdmin } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabase/admin";

/** GET /api/admin/audit?page= — audit log (SPEC §19 Audit log). */
export const GET = handler(async (req: NextRequest) => {
  await requireAdmin();
  const page = Math.max(0, Number(req.nextUrl.searchParams.get("page") ?? 0));
  const size = 100;
  const { data, count, error } = await supabaseAdmin()
    .from("audit_log")
    .select("*, profiles(email)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(page * size, page * size + size - 1);
  if (error) throw error;
  return ok({ entries: data ?? [], total: count ?? 0, page, page_size: size });
});
