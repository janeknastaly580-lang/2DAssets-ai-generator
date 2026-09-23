import type { NextRequest } from "next/server";
import { handler, ok, requireUser, ApiError } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireWorkspaceRole } from "@/lib/workspace";
import { storage } from "@/lib/storage";

/** GET /api/downloads/:id — status + presigned link when ready. */
export const GET = handler(async (_req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const { userId } = await requireUser();
  const { data: dl } = await supabaseAdmin().from("downloads").select("*").eq("id", id).maybeSingle();
  if (!dl) throw new ApiError("not_found", "Download not found", 404);
  await requireWorkspaceRole(dl.workspace_id, userId, "viewer");
  const url = dl.status === "ready" && dl.r2_key ? await storage().presignGet(dl.r2_key, { ttl: 15 * 60, filename: `veyraflow-${id.slice(0, 8)}.zip` }) : null;
  return ok({ id: dl.id, status: dl.status, size_bytes: dl.size_bytes, error: dl.error, expires_at: dl.expires_at, url });
});
