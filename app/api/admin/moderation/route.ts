import type { NextRequest } from "next/server";
import { handler, ok, requireAdmin } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabase/admin";

/** GET /api/admin/moderation?category=&page= — moderation events (SPEC §19 Moderation). */
export const GET = handler(async (req: NextRequest) => {
  await requireAdmin();
  const sp = req.nextUrl.searchParams;
  const page = Math.max(0, Number(sp.get("page") ?? 0));
  const size = 50;
  let q = supabaseAdmin()
    .from("moderation_events")
    .select("*, profiles(email, display_name, banned_at, violations_month)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(page * size, page * size + size - 1);
  const cat = sp.get("category");
  if (cat) q = q.eq("category", cat);
  const { data, count, error } = await q;
  if (error) throw error;
  return ok({ events: data ?? [], total: count ?? 0, page, page_size: size });
});
