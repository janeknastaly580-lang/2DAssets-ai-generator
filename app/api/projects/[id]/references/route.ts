import type { NextRequest } from "next/server";
import { handler, ok, parseJson, requireSameOrigin, requireUser, ApiError } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { addReferenceSchema } from "@/lib/validation/project";
import { requireWorkspaceRole } from "@/lib/workspace";
import { storage, storageKeys } from "@/lib/storage";
import { extractPalette } from "@/lib/postprocess/image";

/** POST — add a reference from a completed upload or a library asset (SPEC §7.1). */
export const POST = handler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  requireSameOrigin(req);
  const { id } = await params;
  const { userId } = await requireUser();
  const db = supabaseAdmin();
  const { data: project } = await db.from("projects").select("id, workspace_id").eq("id", id).maybeSingle();
  if (!project) throw new ApiError("not_found", "Project not found", 404);
  await requireWorkspaceRole(project.workspace_id, userId, "member");
  const body = await parseJson(req, addReferenceSchema);
  const st = storage();

  let sourceKey: string;
  if (body.upload_id) {
    const { data: up } = await db.from("uploads").select("r2_key, completed").eq("id", body.upload_id).eq("workspace_id", project.workspace_id).maybeSingle();
    if (!up?.completed) throw new ApiError("upload_missing", "Upload not found or not completed", 400);
    sourceKey = up.r2_key;
  } else {
    const { data: asset } = await db.from("assets").select("id, type").eq("id", body.asset_id!).eq("workspace_id", project.workspace_id).is("deleted_at", null).maybeSingle();
    if (!asset || asset.type !== "image") throw new ApiError("asset_invalid", "Only image assets can be used as references", 400);
    const { data: file } = await db.from("asset_files").select("r2_key").eq("asset_id", asset.id).eq("format", "png").eq("variant", "main").maybeSingle();
    if (!file) throw new ApiError("asset_invalid", "Asset has no PNG file", 400);
    sourceKey = file.r2_key;
  }
  const png = await st.get(sourceKey);
  const refId = crypto.randomUUID();
  const key = storageKeys.reference(project.workspace_id, refId, "png");
  await st.put(key, png, { contentType: "image/png" });
  const palette = body.kind === "palette" ? await extractPalette(png, 16) : null;
  const { data, error } = await db
    .from("project_references")
    .insert({ id: refId, project_id: id, kind: body.kind, label: body.label ?? null, r2_key: key, asset_id: body.asset_id ?? null, extracted_palette: palette as never, created_by: userId })
    .select("*")
    .single();
  if (error) throw error;
  return ok({ ...data, url: await st.presignGet(key, { inline: true }) }, { status: 201 });
});
