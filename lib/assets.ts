import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { storage } from "@/lib/storage";
import type { Database } from "@/lib/supabase/database.types";
import { ApiError } from "@/lib/api";
import { requireWorkspaceRole, type MemberRole } from "@/lib/workspace";

export type AssetRow = Database["public"]["Tables"]["assets"]["Row"];
export type AssetFileRow = Database["public"]["Tables"]["asset_files"]["Row"];

export interface AssetView extends AssetRow {
  preview_url: string | null;
  animated_preview_url: string | null;
}

/** Attach short-lived preview URLs (inline) to asset rows. */
export async function withPreviewUrls<T extends { preview_key: string | null; animated_preview_key: string | null }>(
  rows: T[],
): Promise<(T & { preview_url: string | null; animated_preview_url: string | null })[]> {
  const st = storage();
  return Promise.all(
    rows.map(async (r) => ({
      ...r,
      preview_url: r.preview_key ? await st.presignGet(r.preview_key, { ttl: 3600, inline: true }) : null,
      animated_preview_url: r.animated_preview_key ? await st.presignGet(r.animated_preview_key, { ttl: 3600, inline: true }) : null,
    })),
  );
}

export interface AssetFileView extends AssetFileRow {
  url: string; // inline (for previews/players)
  ext: string;
}

export async function filesWithUrls(assetId: string): Promise<AssetFileView[]> {
  const { data } = await supabaseAdmin().from("asset_files").select("*").eq("asset_id", assetId).order("created_at");
  const st = storage();
  return Promise.all(
    (data ?? []).map(async (f) => ({
      ...f,
      ext: f.r2_key.split(".").pop() ?? f.format,
      url: await st.presignGet(f.r2_key, { ttl: 3600, inline: true }),
    })),
  );
}

/** Loads an asset and checks workspace membership (throws 404/403). */
export async function loadAsset(id: string, userId: string, minRole: MemberRole = "viewer") {
  const { data: asset } = await supabaseAdmin().from("assets").select("*").eq("id", id).maybeSingle();
  if (!asset) throw new ApiError("not_found", "Asset not found", 404);
  const ctx = await requireWorkspaceRole(asset.workspace_id, userId, minRole);
  return { asset, ...ctx };
}
