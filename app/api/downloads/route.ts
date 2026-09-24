import type { NextRequest } from "next/server";
import { handler, ok, parseJson, requireSameOrigin, requireUser, ApiError } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { downloadRequestSchema } from "@/lib/validation/misc";
import { getCurrentWorkspace, requireWorkspaceRole } from "@/lib/workspace";
import { dispatchDownload } from "@/lib/queue/dispatch";

/** SPEC §23.3 — inline ZIP build runs in `after()`. Vercel: maxDuration 300 (Fluid compute). */
export const maxDuration = 300;

/** POST /api/downloads — ZIP with an engine preset (SPEC §10.6). */
export const POST = handler(async (req: NextRequest) => {
  requireSameOrigin(req);
  const { userId } = await requireUser();
  const body = await parseJson(req, downloadRequestSchema);
  const db = supabaseAdmin();
  let workspaceId: string;
  if (body.project_id) {
    const { data: p } = await db.from("projects").select("workspace_id").eq("id", body.project_id).maybeSingle();
    if (!p) throw new ApiError("not_found", "Project not found", 404);
    workspaceId = p.workspace_id;
  } else {
    const { workspace } = await getCurrentWorkspace(userId);
    workspaceId = workspace.id;
    const { count } = await db.from("assets").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).in("id", body.asset_ids!);
    if (count !== body.asset_ids!.length) throw new ApiError("invalid", "Some assets do not belong to this workspace", 400);
  }
  await requireWorkspaceRole(workspaceId, userId, "viewer");
  const { data: dl, error } = await db
    .from("downloads")
    .insert({ workspace_id: workspaceId, user_id: userId, spec: body as never, status: "queued" })
    .select("id, status, created_at")
    .single();
  if (error) throw error;
  await dispatchDownload(dl.id);
  return ok(dl, { status: 202 });
});

/** GET /api/downloads — recent downloads of the current workspace. */
export const GET = handler(async () => {
  const { userId } = await requireUser();
  const { workspace } = await getCurrentWorkspace(userId);
  const { data } = await supabaseAdmin().from("downloads").select("id, status, size_bytes, expires_at, created_at, spec, error").eq("workspace_id", workspace.id).order("created_at", { ascending: false }).limit(20);
  return ok(data ?? []);
});
