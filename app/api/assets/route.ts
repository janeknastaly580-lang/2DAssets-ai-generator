import type { NextRequest } from "next/server";
import { handler, ok, requireUser } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getCurrentWorkspace } from "@/lib/workspace";
import { withPreviewUrls } from "@/lib/assets";

/**
 * GET /api/assets?project=&type=&q=&tag=&trash=1&cursor=&limit= — library with cursor pagination (SPEC §16.3).
 * Cursor = created_at of the last row.
 */
export const GET = handler(async (req: NextRequest) => {
  const { userId } = await requireUser();
  const { workspace } = await getCurrentWorkspace(userId);
  const sp = req.nextUrl.searchParams;
  const limit = Math.min(100, Number(sp.get("limit") ?? 40));
  const db = supabaseAdmin();
  let q = db.from("assets").select("*").eq("workspace_id", workspace.id).order("created_at", { ascending: false }).limit(limit + 1);
  q = sp.get("trash") === "1" ? q.not("deleted_at", "is", null) : q.is("deleted_at", null);
  const project = sp.get("project");
  if (project) q = q.eq("project_id", project);
  const type = sp.get("type");
  if (type) q = q.eq("type", type as never);
  const status = sp.get("status");
  if (status) q = q.eq("status", status as never);
  const tag = sp.get("tag");
  if (tag) q = q.contains("tags", [tag]);
  const text = sp.get("q");
  if (text) q = q.or(`name.ilike.%${text.replace(/[%,]/g, "")}%,prompt.ilike.%${text.replace(/[%,]/g, "")}%`);
  const cursor = sp.get("cursor");
  if (cursor) q = q.lt("created_at", cursor);
  const { data, error } = await q;
  if (error) throw error;
  const rows = data ?? [];
  const hasMore = rows.length > limit;
  const page = await withPreviewUrls(rows.slice(0, limit));
  return ok({ items: page, next_cursor: hasMore ? page[page.length - 1].created_at : null });
});
