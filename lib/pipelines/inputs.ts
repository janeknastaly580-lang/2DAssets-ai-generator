import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { storage } from "@/lib/storage";
import { JobFailure } from "./types";

export type ImageRef = { kind: "reference" | "asset" | "upload"; id: string };

/** Resolves a reference/asset/upload image (SPEC §9.1 reference_image) into PNG bytes + a presignable key. */
export async function resolveImageInput(ref: ImageRef, workspaceId: string): Promise<{ key: string; png: Buffer }> {
  const db = supabaseAdmin();
  let key: string | null = null;
  if (ref.kind === "reference") {
    const { data } = await db
      .from("project_references")
      .select("r2_key, projects!inner(workspace_id)")
      .eq("id", ref.id)
      .maybeSingle();
    if (data && (data.projects as { workspace_id: string }).workspace_id === workspaceId) key = data.r2_key;
  } else if (ref.kind === "asset") {
    const { data: asset } = await db
      .from("assets")
      .select("id, workspace_id, type")
      .eq("id", ref.id)
      .eq("workspace_id", workspaceId)
      .is("deleted_at", null)
      .maybeSingle();
    if (asset && asset.type === "image") {
      const { data: file } = await db
        .from("asset_files")
        .select("r2_key")
        .eq("asset_id", asset.id)
        .eq("format", "png")
        .or("variant.is.null,variant.eq.main")
        .order("created_at")
        .limit(1)
        .maybeSingle();
      key = file?.r2_key ?? null;
    }
  } else {
    const { data } = await db
      .from("uploads")
      .select("r2_key, completed")
      .eq("id", ref.id)
      .eq("workspace_id", workspaceId)
      .maybeSingle();
    if (data?.completed) key = data.r2_key;
  }
  if (!key) throw new JobFailure("input_not_found", "The selected input image could not be found");
  const png = await storage().get(key);
  return { key, png };
}

export async function presignedInputUrl(key: string): Promise<string> {
  return storage().presignGet(key, { ttl: 60 * 60, inline: true });
}
