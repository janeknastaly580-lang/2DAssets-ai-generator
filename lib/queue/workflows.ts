import "server-only";
import { createWorkflow } from "@upstash/workflow/nextjs";
import { failJobById, runGenerationJob } from "@/lib/pipelines/run";
import type { PipelineRuntime } from "@/lib/pipelines/types";
import { buildDownloadZip } from "@/lib/downloads";
import { buildDataExport } from "@/lib/dataExport";
import { expireCreditsSweep, resetViolationCounters, retentionCleanup } from "@/lib/maintenance";
import { reportError } from "@/lib/errorReporting";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { planFor } from "@/lib/plans";
import { ACTIVE_JOB_STATUSES } from "@/lib/utils";
import type { WorkflowName } from "./upstash";

/**
 * Upstash Workflow definitions (SPEC §14.1). Every `context.run` is a separate HTTP call to
 * /api/workflow/<name>; its return value is stored by Upstash, so steps return only ids, flags and
 * counters — never personal data or links to it.
 */

/** Pipeline time per step; leaves ~120 s of Vercel's 300 s for downloads, post-processing and upload. */
const CHUNK_BUDGET_MS = 180_000;
/** 25 × (180 s + 10 s pause) ≈ 80 min — longer than any provider timeout (SPEC §8.2). */
const MAX_CHUNKS = 25;
/** Waiting for a free plan slot: 120 × 30 s = 60 min, then the job runs anyway. */
const MAX_SLOT_CHECKS = 120;

function runtimeFor(jobId: string): PipelineRuntime {
  return {
    sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
    log: (msg, data) => console.info(`[workflow:${jobId}] ${msg}`, data ?? ""),
    deadline: Date.now() + CHUNK_BUDGET_MS,
  };
}

/** SPEC §8.2 — a job starts only while the workspace runs fewer jobs than its plan allows. */
async function checkSlot(jobId: string, workspaceId: string): Promise<"free" | "wait" | "gone"> {
  const db = supabaseAdmin();
  const { data: job } = await db.from("jobs").select("status").eq("id", jobId).maybeSingle();
  if (!job || ["completed", "failed", "rejected", "cancelled"].includes(job.status)) return "gone";
  const { data: ws } = await db.from("workspaces").select("plan").eq("id", workspaceId).single();
  const limit = planFor(ws?.plan).concurrency;
  const { count } = await db
    .from("jobs")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId)
    .neq("id", jobId)
    .in("status", ACTIVE_JOB_STATUSES.filter((s) => s !== "queued"));
  return (count ?? 0) < limit ? "free" : "wait";
}

export const generateAsset = createWorkflow<{ job_id: string; workspace_id: string }, void>(
  async (context) => {
    const { job_id, workspace_id } = context.requestPayload;

    for (let attempt = 0; attempt < MAX_SLOT_CHECKS; attempt++) {
      const slot = await context.run(`slot-check-${attempt}`, () => checkSlot(job_id, workspace_id));
      if (slot === "gone") return;
      if (slot === "free") break;
      await context.sleep(`wait-slot-${attempt}`, 30);
    }

    // Each chunk polls the provider until its deadline, then yields; the next chunk resumes
    // from the checkpoints in jobs.provider_calls (no second submission, no second charge).
    for (let chunk = 0; chunk < MAX_CHUNKS; chunk++) {
      const state = await context.run(`pipeline-${chunk}`, () => runGenerationJob(job_id, runtimeFor(job_id)));
      if (state === "done") return;
      await context.sleep(`provider-wait-${chunk}`, 10);
    }
    await context.run("give-up", () =>
      failJobById(job_id, "provider_timeout", "The provider took too long. Credits were not charged — please try again."),
    );
  },
  {
    // Retries exhausted (e.g. database outage): never leave the job stuck with credits reserved.
    failureFunction: async ({ context, failResponse }) => {
      await failJobById(context.requestPayload.job_id, "internal_error", "Generation failed. Credits were not charged.");
      await reportError(new Error(`generate-asset workflow failed: ${failResponse}`.slice(0, 500)), { where: "workflow generate-asset" });
    },
  },
);

export const buildDownloadZipWorkflow = createWorkflow<{ download_id: string }, void>(async (context) => {
  await context.run("build", () => buildDownloadZip(context.requestPayload.download_id));
});

export const dataExportWorkflow = createWorkflow<{ user_id: string }, void>(
  async (context) => {
    // buildDataExport returns a presigned link to the user's data — it must not end up in Upstash.
    await context.run("export", async () => {
      await buildDataExport(context.requestPayload.user_id);
    });
  },
  {
    failureFunction: async ({ context, failResponse }) => {
      await reportError(new Error(`data-export workflow failed: ${failResponse}`.slice(0, 500)), {
        where: "workflow data-export",
        userId: context.requestPayload.user_id,
      });
    },
  },
);

export const retentionCleanupWorkflow = createWorkflow<unknown, void>(async (context) => {
  await context.run("cleanup", retentionCleanup);
});

export const expireCreditsWorkflow = createWorkflow<unknown, void>(async (context) => {
  await context.run("expire", expireCreditsSweep);
});

export const resetViolationCountersWorkflow = createWorkflow<unknown, void>(async (context) => {
  await context.run("reset", resetViolationCounters);
});

export const workflows = {
  "generate-asset": generateAsset,
  "build-download-zip": buildDownloadZipWorkflow,
  "data-export": dataExportWorkflow,
  "retention-cleanup": retentionCleanupWorkflow,
  "expire-credits": expireCreditsWorkflow,
  "reset-violation-counters": resetViolationCountersWorkflow,
} satisfies Record<WorkflowName, unknown>;
