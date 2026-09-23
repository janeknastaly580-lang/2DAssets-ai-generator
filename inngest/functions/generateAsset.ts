import { inngest } from "../client";
import { runGenerationJob } from "@/lib/pipelines/run";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { planFor } from "@/lib/plans";
import { ACTIVE_JOB_STATUSES } from "@/lib/utils";

/**
 * SPEC §8 / §14.1 `generate-asset`. The pipeline itself is stage-idempotent (persists status and
 * provider job ids), so a retried run resumes rather than resubmits. Per-plan concurrency (§8.2)
 * is enforced by holding queued jobs while the workspace has enough active ones.
 */
export const generateAsset = inngest.createFunction(
  {
    id: "generate-asset",
    retries: 2,
    concurrency: [{ key: "event.data.workspace_id", limit: 5 }],
    cancelOn: [{ event: "asset/generate.cancelled", match: "data.job_id" }],
  },
  { event: "asset/generate.requested" },
  async ({ event, step }) => {
    const { job_id, workspace_id } = event.data;

    // wait for a free slot according to the workspace plan
    for (let attempt = 0; attempt < 120; attempt++) {
      const free = await step.run(`slot-check-${attempt}`, async () => {
        const db = supabaseAdmin();
        const { data: ws } = await db.from("workspaces").select("plan").eq("id", workspace_id).single();
        const limit = planFor(ws?.plan).concurrency;
        const { count } = await db
          .from("jobs")
          .select("id", { count: "exact", head: true })
          .eq("workspace_id", workspace_id)
          .neq("id", job_id)
          .in("status", ACTIVE_JOB_STATUSES.filter((s) => s !== "queued"));
        return (count ?? 0) < limit;
      });
      if (free) break;
      await step.sleep(`wait-slot-${attempt}`, "30s");
    }

    await step.run("run-pipeline", async () => {
      await runGenerationJob(job_id, {
        sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
        log: (msg, data) => console.info(`[inngest:${job_id}] ${msg}`, data ?? ""),
      });
    });
    return { job_id };
  },
);
