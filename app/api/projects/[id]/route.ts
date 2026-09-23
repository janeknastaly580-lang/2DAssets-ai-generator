import type { NextRequest } from "next/server";
import { handler, ok, parseJson, requireSameOrigin, requireUser, ApiError } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { updateProjectSchema } from "@/lib/validation/project";
import { requireWorkspaceRole } from "@/lib/workspace";
import { storage } from "@/lib/storage";
import type { Database } from "@/lib/supabase/database.types";

type Ctx = { params: Promise<{ id: string }> };

async function loadProject(id: string, userId: string, minRole: "viewer" | "member" | "admin" = "viewer") {
  const { data: project } = await supabaseAdmin().from("projects").select("*").eq("id", id).maybeSingle();
  if (!project) throw new ApiError("not_found", "Project not found", 404);
  const ctx = await requireWorkspaceRole(project.workspace_id, userId, minRole);
  return { project, ...ctx };
}

export const GET = handler(async (_req: NextRequest, { params }: Ctx) => {
  const { id } = await params;
  const { userId } = await requireUser();
  const { project, role } = await loadProject(id, userId);
  const db = supabaseAdmin();
  const { data: references } = await db.from("project_references").select("*").eq("project_id", id).order("created_at");
  const st = storage();
  const refs = await Promise.all(
    (references ?? []).map(async (r) => ({ ...r, url: await st.presignGet(r.r2_key, { inline: true }) })),
  );
  return ok({ ...project, role, references: refs });
});

export const PATCH = handler(async (req: NextRequest, { params }: Ctx) => {
  requireSameOrigin(req);
  const { id } = await params;
  const { userId } = await requireUser();
  const { project } = await loadProject(id, userId, "member");
  const body = await parseJson(req, updateProjectSchema);
  const patch: Database["public"]["Tables"]["projects"]["Update"] = {};
  if (body.name !== undefined && !project.is_scratch) patch.name = body.name;
  if (body.description !== undefined) patch.description = body.description;
  if (body.style_guide !== undefined && !project.is_scratch) patch.style_guide = body.style_guide as never;
  if (body.archived !== undefined && !project.is_scratch) patch.archived_at = body.archived ? new Date().toISOString() : null;
  if (body.cover_asset_id !== undefined) patch.cover_asset_id = body.cover_asset_id;
  const { data, error } = await supabaseAdmin().from("projects").update(patch).eq("id", id).select("*").single();
  if (error) throw error;
  return ok(data);
});

export const DELETE = handler(async (req: NextRequest, { params }: Ctx) => {
  requireSameOrigin(req);
  const { id } = await params;
  const { userId } = await requireUser();
  const { project, role } = await loadProject(id, userId, "member");
  if (project.is_scratch) throw new ApiError("forbidden", "The Scratch project cannot be deleted", 400);
  if (role === "member" && project.created_by !== userId) throw new ApiError("forbidden", "Members can only delete their own projects", 403);
  await storage().deletePrefix(`ws/${project.workspace_id}/proj/${id}/`).catch(() => undefined);
  const { error } = await supabaseAdmin().from("projects").delete().eq("id", id);
  if (error) throw error;
  return ok({ deleted: id });
});
