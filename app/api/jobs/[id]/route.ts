import type { NextRequest } from "next/server";
import { handler, ok, requireUser, ApiError } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireWorkspaceRole } from "@/lib/workspace";

/** GET /api/jobs/:id — details without translated_prompt / provider internals (SPEC §16.3). */
export const GET = handler(async (_req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const { userId } = await requireUser();
  const { data: job } = await supabaseAdmin().from("jobs_public").select("*").eq("id", id).maybeSingle();
  if (!job) throw new ApiError("not_found", "Job not found", 404);
  await requireWorkspaceRole(job.workspace_id!, userId, "viewer");
  return ok(job);
});
