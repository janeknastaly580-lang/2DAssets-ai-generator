import "server-only";
import { after } from "next/server";
import { env, integrations } from "@/lib/env";
import { runGenerationJob } from "@/lib/pipelines/run";
import { buildDownloadZip } from "@/lib/downloads";
import { buildDataExport } from "@/lib/dataExport";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { planFor } from "@/lib/plans";
import { reportError } from "@/lib/errorReporting";
import { workflowClient, workflowUrl, type WorkflowName } from "./upstash";

/**
 * Queue dispatcher. With Upstash configured (QSTASH_TOKEN) work is triggered as an Upstash Workflow
 * run; otherwise — or when the trigger fails — it runs inline after the response is sent (`after()`),
 * which keeps localhost fully functional without extra processes (SPEC §14.1, §25.1).
 */
const LOCAL_URL = /^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/;

async function trigger(name: WorkflowName, body: Record<string, string>, opts: { runId?: string; retries?: number } = {}) {
  if (!integrations.queue) return null;
  const url = workflowUrl(name);
  // Cloud QStash cannot call localhost — the run would never start. Use the emulator (pnpm qstash:dev) or inline.
  if (LOCAL_URL.test(url) && !LOCAL_URL.test(env.QSTASH_URL)) return null;
  try {
    const { workflowRunId } = await workflowClient().trigger({
      url,
      body,
      workflowRunId: opts.runId,
      retries: opts.retries ?? 3,
      disableTelemetry: true,
    });
    return workflowRunId;
  } catch (e) {
    console.warn(`[queue] Upstash trigger ${name} failed, falling back to inline execution:`, (e as Error).message);
    return null;
  }
}

export async function dispatchGeneration(jobId: string, workspaceId: string): Promise<"queue" | "inline"> {
  const runId = await trigger("generate-asset", { job_id: jobId, workspace_id: workspaceId }, { runId: `gen-${jobId}` });
  if (runId) {
    await supabaseAdmin().from("jobs").update({ workflow_run_id: runId }).eq("id", jobId);
    return "queue";
  }
  after(() => runInlineQueue(workspaceId));
  return "inline";
}

const running = new Set<string>();

/** Inline scheduler: respects plan concurrency; drains queued jobs of a workspace in FIFO order. */
export async function runInlineQueue(workspaceId: string): Promise<void> {
  if (running.has(workspaceId)) return;
  running.add(workspaceId);
  try {
    const db = supabaseAdmin();
    for (;;) {
      const { data: ws } = await db.from("workspaces").select("plan").eq("id", workspaceId).single();
      const limit = planFor(ws?.plan).concurrency;
      const { count: active } = await db
        .from("jobs")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", workspaceId)
        .in("status", ["moderating", "translating", "generating", "post_processing", "uploading"]);
      if ((active ?? 0) >= limit) break;
      const { data: next } = await db
        .from("jobs")
        .select("id")
        .eq("workspace_id", workspaceId)
        .eq("status", "queued")
        .order("created_at")
        .limit(1)
        .maybeSingle();
      if (!next) break;
      await runGenerationJob(next.id).catch((e) => {
        console.error("[queue] job failed", e);
        return reportError(e, { where: "queue inline job" });
      });
    }
  } finally {
    running.delete(workspaceId);
  }
}

export async function dispatchDownload(downloadId: string) {
  if (await trigger("build-download-zip", { download_id: downloadId }, { retries: 1 })) return;
  after(() => buildDownloadZip(downloadId));
}

export async function dispatchDataExport(userId: string) {
  if (await trigger("data-export", { user_id: userId }, { retries: 1 })) return;
  after(() =>
    buildDataExport(userId).catch((e) => {
      console.error("[export] failed", e);
      return reportError(e, { where: "data export", userId });
    }),
  );
}
