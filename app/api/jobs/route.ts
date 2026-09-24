import type { NextRequest } from "next/server";
import { handler, ok, parseJson, requireSameOrigin, requireUser, ApiError } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createJobSchema, parseJobInput } from "@/lib/validation/jobs";
import { getCurrentWorkspace, isWorkspaceReadOnly, requireWorkspaceRole, roleAtLeast } from "@/lib/workspace";
import { estimateJob } from "@/lib/credits/pricing";
import { getBalance, reserveCredits } from "@/lib/credits/ledger";
import { dispatchGeneration } from "@/lib/queue/dispatch";
import { LIMITS, rateLimit } from "@/lib/auth/ratelimit";
import { isFlagEnabled, PIPELINE_FLAG } from "@/lib/flags";
import { MAX_QUEUED_JOBS_PER_WORKSPACE } from "@/lib/plans";
import { ACTIVE_JOB_STATUSES } from "@/lib/utils";

/** SPEC §23.3 — inline queue (no Inngest) runs the pipeline in `after()`. Vercel: maxDuration 300 (Fluid compute). */
export const maxDuration = 300;

/** GET /api/jobs?status=&type=&project=&limit= — jobs of the current workspace (no translated_prompt). */
export const GET = handler(async (req: NextRequest) => {
  const { userId } = await requireUser();
  const { workspace } = await getCurrentWorkspace(userId);
  const sp = req.nextUrl.searchParams;
  const db = supabaseAdmin();
  let q = db
    .from("jobs_public")
    .select("*")
    .eq("workspace_id", workspace.id)
    .order("created_at", { ascending: false })
    .limit(Math.min(100, Number(sp.get("limit") ?? 50)));
  const status = sp.get("status");
  if (status === "active") q = q.in("status", ACTIVE_JOB_STATUSES);
  else if (status) q = q.eq("status", status as never);
  const type = sp.get("type");
  if (type) q = q.eq("type", type as never);
  const project = sp.get("project");
  if (project) q = q.eq("project_id", project);
  const { data, error } = await q;
  if (error) throw error;
  return ok(data ?? []);
});

/**
 * POST /api/jobs — SPEC §16.3: validate input + plan gates, estimate, create job (queued),
 * reserve credits atomically, dispatch to the queue.
 */
export const POST = handler(async (req: NextRequest) => {
  requireSameOrigin(req);
  const { userId } = await requireUser();
  await rateLimit(`jobs:user:${userId}`, LIMITS.jobsPerUser.window, LIMITS.jobsPerUser.limit);
  const body = await parseJson(req, createJobSchema);
  const db = supabaseAdmin();

  const { data: project } = await db.from("projects").select("*").eq("id", body.project_id).maybeSingle();
  if (!project || project.archived_at) throw new ApiError("project_not_found", "Project not found", 404);
  const { workspace, role } = await requireWorkspaceRole(project.workspace_id, userId, "viewer");
  if (!roleAtLeast(role, "member")) throw new ApiError("forbidden", "Viewers cannot generate assets", 403);
  if (isWorkspaceReadOnly(workspace)) throw new ApiError("read_only", "This team workspace needs an active Studio subscription to generate", 403);
  if (!(await isFlagEnabled(PIPELINE_FLAG[body.type], true))) throw new ApiError("pipeline_disabled", "This generator is temporarily disabled", 503);
  if (await isFlagEnabled("maintenance_mode", false)) throw new ApiError("maintenance", "Veyraflow is undergoing maintenance", 503);
  if (workspace.storage_used_bytes >= workspace.storage_quota_bytes) {
    throw new ApiError("storage_full", "Storage quota reached. Free up space or upgrade your plan.", 403);
  }
  if (workspace.subscription_status === "past_due" && workspace.current_period_end) {
    const overdueDays = (Date.now() - new Date(workspace.current_period_end).getTime()) / 86_400_000;
    if (overdueDays > 7) throw new ApiError("past_due", "Your subscription payment failed. Update your payment method to continue.", 403);
  }

  const input = parseJobInput(body.type, body.input);
  const estimate = await estimateJob(body.type, input, workspace.plan);

  const { count: queued } = await db
    .from("jobs")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspace.id)
    .in("status", ACTIVE_JOB_STATUSES);
  if ((queued ?? 0) >= MAX_QUEUED_JOBS_PER_WORKSPACE) throw new ApiError("queue_full", "Too many jobs in the queue. Wait for some to finish.", 429);

  const balance = await getBalance(workspace.id);
  if (balance.available < estimate.credits) {
    throw new ApiError("insufficient_credits", `This job needs ${estimate.credits} credits but only ${balance.available} are available.`, 402, {
      needed: estimate.credits,
      available: balance.available,
    });
  }

  const { data: job, error } = await db
    .from("jobs")
    .insert({
      workspace_id: workspace.id,
      project_id: project.id,
      user_id: userId,
      type: body.type,
      status: "queued",
      input: input as never,
      credits_estimated: estimate.credits,
      provider: estimate.provider,
      provider_model: estimate.provider_model,
    })
    .select("id, status, credits_estimated, created_at")
    .single();
  if (error || !job) throw error ?? new Error("job insert failed");

  const reserved = await reserveCredits(workspace.id, job.id, estimate.credits);
  if (!reserved) {
    await db.from("jobs").update({ status: "failed", error_code: "insufficient_credits", error_message: "Insufficient credits", finished_at: new Date().toISOString() }).eq("id", job.id);
    throw new ApiError("insufficient_credits", "Insufficient credits", 402);
  }
  const via = await dispatchGeneration(job.id, workspace.id);
  return ok({ ...job, estimate, queue: via }, { status: 201 });
});
