import type { NextRequest } from "next/server";
import { handler, ok, requireUser, ApiError } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { loadAsset } from "@/lib/assets";
import { storage } from "@/lib/storage";
import { slugify } from "@/lib/utils";

/** GET /api/assets/:id/download?file=<fileId> — presigned GET, 15 min, attachment (SPEC §10.6). */
export const GET = handler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const { userId } = await requireUser();
  const { asset } = await loadAsset(id, userId, "viewer");
  const fileId = req.nextUrl.searchParams.get("file");
  if (!fileId) throw new ApiError("invalid", "file is required", 400);
  const { data: file } = await supabaseAdmin().from("asset_files").select("*").eq("id", fileId).eq("asset_id", id).maybeSingle();
  if (!file) throw new ApiError("not_found", "File not found", 404);
  const ext = file.r2_key.split(".").pop();
  const filename = `${slugify(asset.name, 40)}_${file.variant ?? file.format}.${ext}`;
  const url = await storage().presignGet(file.r2_key, { ttl: 15 * 60, filename });
  if (req.nextUrl.searchParams.get("redirect") === "1") return Response.redirect(url, 302);
  return ok({ url, filename, expires_in: 900 });
});
