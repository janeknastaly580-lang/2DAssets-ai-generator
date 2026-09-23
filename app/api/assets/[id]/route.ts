import type { NextRequest } from "next/server";
import { handler, ok, parseJson, requireSameOrigin, requireUser, ApiError } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { updateAssetSchema } from "@/lib/validation/misc";
import { filesWithUrls, loadAsset, withPreviewUrls } from "@/lib/assets";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/assets/:id — asset + files (inline URLs) + derived assets + share links. */
export const GET = handler(async (_req: NextRequest, { params }: Ctx) => {
  const { id } = await params;
  const { userId } = await requireUser();
  const { asset, role } = await loadAsset(id, userId);
  const db = supabaseAdmin();
  const [files, { data: derived }, { data: project }, { data: shares }] = await Promise.all([
    filesWithUrls(id),
    db.from("assets").select("*").eq("parent_asset_id", id).is("deleted_at", null).order("created_at", { ascending: false }),
    db.from("projects").select("id, name, style_guide").eq("id", asset.project_id).single(),
    db.from("share_links").select("id, allow_download, show_prompt, expires_at, revoked_at, view_count, created_at").eq("target_type", "asset").eq("target_id", id).is("revoked_at", null),
  ]);
  const [view] = await withPreviewUrls([asset]);
  return ok({ ...view, role, files, derived: await withPreviewUrls(derived ?? []), project, shares: shares ?? [] });
});

/** PATCH — rename, tags, move to project (member). */
export const PATCH = handler(async (req: NextRequest, { params }: Ctx) => {
  requireSameOrigin(req);
  const { id } = await params;
  const { userId } = await requireUser();
  const { asset } = await loadAsset(id, userId, "member");
  const body = await parseJson(req, updateAssetSchema);
  const db = supabaseAdmin();
  if (body.project_id) {
    const { data: p } = await db.from("projects").select("workspace_id").eq("id", body.project_id).maybeSingle();
    if (!p || p.workspace_id !== asset.workspace_id) throw new ApiError("invalid", "Target project must be in the same workspace", 400);
  }
  const { data, error } = await db.from("assets").update({ name: body.name, tags: body.tags, project_id: body.project_id }).eq("id", id).select("*").single();
  if (error) throw error;
  return ok(data);
});

/** DELETE — soft delete to Trash (14 days) — SPEC §13. */
export const DELETE = handler(async (req: NextRequest, { params }: Ctx) => {
  requireSameOrigin(req);
  const { id } = await params;
  const { userId } = await requireUser();
  const { asset, role } = await loadAsset(id, userId, "member");
  if (role === "member" && asset.created_by !== userId) throw new ApiError("forbidden", "Members can only delete their own assets", 403);
  await supabaseAdmin().from("assets").update({ deleted_at: new Date().toISOString() }).eq("id", id);
  return ok({ deleted: id });
});
