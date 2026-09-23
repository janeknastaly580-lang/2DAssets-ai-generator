import type { NextRequest } from "next/server";
import { handler, ok, requireSameOrigin, requireUser, ApiError } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireWorkspaceRole } from "@/lib/workspace";
import { storage } from "@/lib/storage";

export const DELETE = handler(async (req: NextRequest, { params }: { params: Promise<{ id: string; refId: string }> }) => {
  requireSameOrigin(req);
  const { id, refId } = await params;
  const { userId } = await requireUser();
  const db = supabaseAdmin();
  const { data: project } = await db.from("projects").select("workspace_id").eq("id", id).maybeSingle();
  if (!project) throw new ApiError("not_found", "Project not found", 404);
  await requireWorkspaceRole(project.workspace_id, userId, "member");
  const { data: ref } = await db.from("project_references").select("r2_key").eq("id", refId).eq("project_id", id).maybeSingle();
  if (!ref) throw new ApiError("not_found", "Reference not found", 404);
  await storage().delete(ref.r2_key).catch(() => undefined);
  await db.from("project_references").delete().eq("id", refId);
  return ok({ deleted: refId });
});
