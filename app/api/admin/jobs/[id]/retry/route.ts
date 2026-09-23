import type { NextRequest } from "next/server";
import { z } from "zod";
import { handler, ok, parseJson, requireSameOrigin, requireAdmin, audit, getClientIp, ApiError } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { grantCredits, reserveCredits } from "@/lib/credits/ledger";
import { dispatchGeneration } from "@/lib/queue/dispatch";

const schema = z.object({ mode: z.enum(["retry", "refund"]).default("retry"), reason: z.string().trim().min(3).max(300) });

/**
 * POST /api/admin/jobs/:id/retry — "Retry" (new job at the system's cost via admin_adjustment
 * compensation) or "Refund credits" for a completed job (SPEC §19 Jobs).
 */
export const POST = handler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  requireSameOrigin(req);
  const admin = await requireAdmin();
  const { id } = await params;
  const body = await parseJson(req, schema);
  const db = supabaseAdmin();
  const { data: job } = await db.from("jobs").select("*").eq("id", id).maybeSingle();
  if (!job) throw new ApiError("not_found", "Job not found", 404);
  const ip = getClientIp(req);

  if (body.mode === "refund") {
    const amount = job.credits_charged ?? 0;
    if (amount <= 0) throw new ApiError("nothing_to_refund", "This job did not charge credits", 400);
    await grantCredits({ workspaceId: job.workspace_id, bucket: "purchased", amount, kind: "refund", ref: `refund:${job.id}`, actorId: admin.userId, description: body.reason });
    await audit(admin.userId, "admin.job.refund", { type: "job", id }, { amount, reason: body.reason }, ip);
    return ok({ refunded: amount });
  }

  // compensate the estimate, then create a fresh job with the same input
  await grantCredits({ workspaceId: job.workspace_id, bucket: "purchased", amount: job.credits_estimated, kind: "admin_adjustment", actorId: admin.userId, description: `Admin retry of job ${job.id}: ${body.reason}` });
  const { data: fresh, error } = await db
    .from("jobs")
    .insert({ workspace_id: job.workspace_id, project_id: job.project_id, user_id: job.user_id, type: job.type, input: job.input, credits_estimated: job.credits_estimated, provider: job.provider, provider_model: job.provider_model })
    .select("id")
    .single();
  if (error || !fresh) throw error ?? new Error("insert failed");
  const reserved = await reserveCredits(job.workspace_id, fresh.id, job.credits_estimated);
  if (!reserved) throw new ApiError("reserve_failed", "Could not reserve credits for the retry", 500);
  await dispatchGeneration(fresh.id, job.workspace_id);
  await audit(admin.userId, "admin.job.retry", { type: "job", id }, { new_job_id: fresh.id, reason: body.reason }, ip);
  return ok({ new_job_id: fresh.id });
});
