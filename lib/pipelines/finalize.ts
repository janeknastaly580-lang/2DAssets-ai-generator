import "server-only";
import { createHash } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { storage, storageKeys, mimeFor } from "@/lib/storage";
import { adjustStorage } from "@/lib/credits/ledger";
import { assetExpiryFor } from "@/lib/plans";
import { slugify } from "@/lib/utils";
import type { JobRow, OutputAsset, WorkspaceRow } from "./types";

/** SPEC §8 step 7 — upload outputs and create `assets` / `asset_files` rows. */
export async function persistOutputs(job: JobRow, workspace: WorkspaceRow, outputs: OutputAsset[]): Promise<string[]> {
  const db = supabaseAdmin();
  const st = storage();
  const ids: string[] = [];
  const projectId = job.project_id!;
  const expiresAt = assetExpiryFor(workspace.plan);
  let totalBytes = 0;

  for (const out of outputs) {
    const { data: asset, error } = await db
      .from("assets")
      .insert({
        workspace_id: workspace.id,
        project_id: projectId,
        type: out.type,
        name: out.name.slice(0, 120),
        slug: `${slugify(out.name, 40)}-${Math.random().toString(36).slice(2, 7)}`,
        status: "processing",
        source_job_id: job.id,
        parent_asset_id: out.parentAssetId ?? null,
        prompt: out.prompt,
        metadata: out.metadata as never,
        created_by: job.user_id,
        expires_at: expiresAt ? expiresAt.toISOString() : null,
      })
      .select("id")
      .single();
    if (error || !asset) throw error ?? new Error("asset insert failed");

    let size = 0;
    const fileRows = [];
    for (const f of out.files) {
      const key = storageKeys.assetFile(workspace.id, projectId, asset.id, f.variant ?? f.format, f.ext);
      await st.put(key, f.body, { contentType: mimeFor(f.ext) });
      size += f.body.byteLength;
      fileRows.push({
        asset_id: asset.id,
        format: f.format,
        variant: f.variant,
        engine_preset: f.engine_preset,
        r2_key: key,
        size_bytes: f.body.byteLength,
        checksum_sha256: createHash("sha256").update(f.body).digest("hex"),
      });
    }
    if (fileRows.length) {
      const { error: fe } = await db.from("asset_files").insert(fileRows);
      if (fe) throw fe;
    }

    let previewKey: string | null = null;
    let animatedKey: string | null = null;
    if (out.preview) {
      previewKey = storageKeys.assetPreview(workspace.id, projectId, asset.id, "thumb.png");
      await st.put(previewKey, out.preview, { contentType: "image/png" });
      size += out.preview.byteLength;
    }
    if (out.animatedPreview) {
      animatedKey = storageKeys.assetPreview(workspace.id, projectId, asset.id, "preview.gif");
      await st.put(animatedKey, out.animatedPreview, { contentType: "image/gif" });
      size += out.animatedPreview.byteLength;
    }
    await db
      .from("assets")
      .update({ status: "ready", preview_key: previewKey, animated_preview_key: animatedKey, size_bytes: size })
      .eq("id", asset.id);
    totalBytes += size;
    ids.push(asset.id);
  }
  if (totalBytes) await adjustStorage(workspace.id, totalBytes);
  return ids;
}
