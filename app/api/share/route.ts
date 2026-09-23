import type { NextRequest } from "next/server";
import { handler, ok, parseJson, requireSameOrigin, requireUser, ApiError } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createShareSchema } from "@/lib/validation/misc";
import { requireWorkspaceRole, getCurrentWorkspace } from "@/lib/workspace";
import { newShareToken, shareUrl } from "@/lib/share";

/** POST /api/share — create a private link; the full URL is returned exactly once (SPEC §18). */
export const POST = handler(async (req: NextRequest) => {
  requireSameOrigin(req);
  const { userId } = await requireUser();
  const body = await parseJson(req, createShareSchema);
  const db = supabaseAdmin();
  const table = body.target_type === "asset" ? "assets" : "projects";
  const { data: target } = await db.from(table).select("workspace_id").eq("id", body.target_id).maybeSingle();
  if (!target) throw new ApiError("not_found", "Target not found", 404);
  await requireWorkspaceRole(target.workspace_id, userId, "member");
  const { token, hash } = newShareToken();
  const { data, error } = await db
    .from("share_links")
    .insert({
      workspace_id: target.workspace_id,
      target_type: body.target_type,
      target_id: body.target_id,
      token_hash: hash,
      allow_download: body.allow_download,
      show_prompt: body.show_prompt,
      expires_at: body.expires_in_days ? new Date(Date.now() + body.expires_in_days * 86_400_000).toISOString() : null,
      created_by: userId,
    })
    .select("id, target_type, target_id, allow_download, show_prompt, expires_at, created_at")
    .single();
  if (error) throw error;
  return ok({ ...data, url: shareUrl(token) }, { status: 201 });
});

/** GET /api/share — links of the current workspace. */
export const GET = handler(async () => {
  const { userId } = await requireUser();
  const { workspace } = await getCurrentWorkspace(userId);
  const { data } = await supabaseAdmin()
    .from("share_links")
    .select("id, target_type, target_id, allow_download, show_prompt, expires_at, revoked_at, view_count, created_at")
    .eq("workspace_id", workspace.id)
    .is("revoked_at", null)
    .order("created_at", { ascending: false });
  return ok(data ?? []);
});
