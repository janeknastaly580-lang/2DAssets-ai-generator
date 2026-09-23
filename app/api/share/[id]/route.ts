import type { NextRequest } from "next/server";
import { handler, ok, requireSameOrigin, requireUser, ApiError } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireWorkspaceRole } from "@/lib/workspace";

/** DELETE /api/share/:id — revoke immediately (SPEC §18). */
export const DELETE = handler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  requireSameOrigin(req);
  const { id } = await params;
  const { userId } = await requireUser();
  const db = supabaseAdmin();
  const { data: link } = await db.from("share_links").select("id, workspace_id").eq("id", id).maybeSingle();
  if (!link) throw new ApiError("not_found", "Link not found", 404);
  await requireWorkspaceRole(link.workspace_id, userId, "member");
  await db.from("share_links").update({ revoked_at: new Date().toISOString() }).eq("id", id);
  return ok({ revoked: id });
});
