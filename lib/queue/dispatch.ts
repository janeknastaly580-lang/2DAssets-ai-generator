import "server-only";
import { after } from "next/server";
import { inngest } from "@/inngest/client";
import { integrations } from "@/lib/env";
import { runGenerationJob } from "@/lib/pipelines/run";
import { buildDownloadZip } from "@/lib/downloads";
import { buildDataExport } from "@/lib/dataExport";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { planFor } from "@/lib/plans";

/**
 * Queue dispatcher. With Inngest configured (INNGEST_EVENT_KEY, or the local dev server reachable)
 * events go to Inngest; otherwise work runs inline after the response is sent (`after()`), which keeps
 * localhost fully functional without extra processes (SPEC §14.1, §25.1).
 */
async function trySend(event: Parameters<typeof inngest.send>[0]): Promise<boolean> {
  if (!integrations.inngest && process.env.INNGEST_DEV !== "1") return false;
  try {
    await inngest.send(event);
    return true;
  } catch (e) {
    console.warn("[queue] inngest.send failed, falling back to inline execution:", (e as Error).message);
    return false;
  }
}

export async function dispatchGeneration(jobId: string, workspaceId: string): Promise<"inngest" | "inline"> {
  if (await trySend({ name: "asset/generate.requested", data: { job_id: jobId, workspace_id: workspaceId } })) return "inngest";
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
      await runGenerationJob(next.id).catch((e) => console.error("[queue] job failed", e));
    }
  } finally {
    running.delete(workspaceId);
  }
}

export async function dispatchDownload(downloadId: string) {
  if (await trySend({ name: "download/zip.requested", data: { download_id: downloadId } })) return;
  after(() => buildDownloadZip(downloadId));
}

export async function dispatchDataExport(userId: string) {
  if (await trySend({ name: "account/export.requested", data: { user_id: userId } })) return;
  after(() => buildDataExport(userId).catch((e) => console.error("[export] failed", e)));
}

export async function dispatchCancel(jobId: string) {
  await trySend({ name: "asset/generate.cancelled", data: { job_id: jobId } });
}
