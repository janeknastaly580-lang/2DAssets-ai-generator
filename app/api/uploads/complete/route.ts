import type { NextRequest } from "next/server";
import { handler, ok, parseJson, requireSameOrigin, requireUser, ApiError } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { completeUploadSchema } from "@/lib/validation/misc";
import { storage } from "@/lib/storage";
import { sanitizeUpload } from "@/lib/postprocess/image";

const MAGIC: Record<string, (b: Buffer) => boolean> = {
  "image/png": (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  "image/jpeg": (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  "image/webp": (b) => b.subarray(0, 4).toString("ascii") === "RIFF" && b.subarray(8, 12).toString("ascii") === "WEBP",
};

/** POST /api/uploads/complete — HEAD, magic-bytes check, re-encode through sharp (strips EXIF) — SPEC §13/§22. */
export const POST = handler(async (req: NextRequest) => {
  requireSameOrigin(req);
  const { userId } = await requireUser();
  const body = await parseJson(req, completeUploadSchema);
  const db = supabaseAdmin();
  const { data: up } = await db.from("uploads").select("*").eq("id", body.upload_id).eq("user_id", userId).maybeSingle();
  if (!up) throw new ApiError("not_found", "Upload not found", 404);
  const st = storage();
  const head = await st.head(up.r2_key);
  if (!head) throw new ApiError("not_uploaded", "File was not uploaded", 400);
  if (head.size > up.size_bytes + 1024) throw new ApiError("too_large", "Uploaded file is larger than declared", 400);
  const buf = await st.get(up.r2_key);
  if (!MAGIC[up.mime]?.(buf)) {
    await st.delete(up.r2_key);
    await db.from("uploads").delete().eq("id", up.id);
    throw new ApiError("invalid_file", "File content does not match its type", 400);
  }
  const { png, width, height } = await sanitizeUpload(buf);
  const pngKey = up.r2_key.replace(/\.[a-z0-9]+$/i, ".png");
  await st.put(pngKey, png, { contentType: "image/png" });
  if (pngKey !== up.r2_key) await st.delete(up.r2_key);
  await db
    .from("uploads")
    .update({ completed: true, r2_key: pngKey, mime: "image/png", size_bytes: png.byteLength })
    .eq("id", up.id);
  if (pngKey.startsWith("users/")) await db.from("profiles").update({ avatar_key: pngKey }).eq("id", userId);
  return ok({ upload_id: up.id, key: pngKey, width, height, url: await st.presignGet(pngKey, { inline: true, ttl: 3600 }) });
});
