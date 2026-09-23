import type { NextRequest } from "next/server";
import { handler, ok, requireSameOrigin, requireUser, ApiError } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireWorkspaceRole } from "@/lib/workspace";
import { releaseReservation } from "@/lib/credits/ledger";
import { dispatchCancel } from "@/lib/queue/dispatch";

/**
 * POST /api/jobs/:id/cancel — SPEC §8.2: full refund before the provider request; afterwards the
 * wait is interrupted and credits are settled by the pipeline.
 */
export const POST = handler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  requireSameOrigin(req);
  const { id } = await params;
  const { userId } = await requireUser();
  const db = supabaseAdmin();
  const { data: job } = await db.from("jobs").select("id, workspace_id, user_id, status, provider_job_id").eq("id", id).maybeSingle();
  if (!job) throw new ApiError("not_found", "Job not found", 404);
  const { role } = await requireWorkspaceRole(job.workspace_id, userId, "member");
  if (job.user_id !== userId && !["owner", "admin"].includes(role)) throw new ApiError("forbidden", "You can only cancel your own jobs", 403);
  if (["completed", "failed", "rejected", "cancelled"].includes(job.status)) return ok({ status: job.status });
  const refundable = ["queued", "moderating", "translating"].includes(job.status) || !job.provider_job_id;
  if (refundable) await releaseReservation(id);
  await db.from("jobs").update({ status: "cancelled", finished_at: new Date().toISOString(), error_code: "cancelled" }).eq("id", id);
  await dispatchCancel(id);
  return ok({ status: "cancelled", refunded: refundable });
});
