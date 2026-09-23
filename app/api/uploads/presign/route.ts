import type { NextRequest } from "next/server";
import { handler, ok, parseJson, requireSameOrigin, requireUser, ApiError } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { presignUploadSchema } from "@/lib/validation/misc";
import { getCurrentWorkspace, roleAtLeast } from "@/lib/workspace";
import { storage, storageKeys, extForMime } from "@/lib/storage";
import { LIMITS, rateLimit } from "@/lib/auth/ratelimit";

/** POST /api/uploads/presign — validated presigned PUT (SPEC §13, §22). Avatars: 2 MB. */
export const POST = handler(async (req: NextRequest) => {
  requireSameOrigin(req);
  const { userId } = await requireUser();
  await rateLimit(`uploads:user:${userId}`, LIMITS.uploadsPerUser.window, LIMITS.uploadsPerUser.limit);
  const body = await parseJson(req, presignUploadSchema);
  const { workspace, role } = await getCurrentWorkspace(userId);
  if (!roleAtLeast(role, "member")) throw new ApiError("forbidden", "Viewers cannot upload", 403);
  if (body.purpose === "avatar" && body.size_bytes > 2 * 1024 * 1024) throw new ApiError("too_large", "Avatar must be ≤ 2 MB", 400);
  const id = crypto.randomUUID();
  const ext = extForMime(body.mime);
  const key = body.purpose === "avatar" ? storageKeys.avatar(userId, ext) : storageKeys.upload(workspace.id, id, ext);
  const { error } = await supabaseAdmin()
    .from("uploads")
    .insert({ id, workspace_id: workspace.id, user_id: userId, r2_key: key, mime: body.mime, size_bytes: body.size_bytes });
  if (error) throw error;
  const url = await storage().presignPut(key, body.mime, body.size_bytes, 10 * 60);
  return ok({ upload_id: id, url, key, method: "PUT", headers: { "Content-Type": body.mime } });
});
