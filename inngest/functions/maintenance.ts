import { inngest } from "../client";
import { expireCreditsSweep, resetViolationCounters, retentionCleanup } from "@/lib/maintenance";
import { buildDownloadZip } from "@/lib/downloads";
import { buildDataExport } from "@/lib/dataExport";
import { sendTemplateEmail, type TemplateAlias } from "@/lib/email/resend";
import { supabaseAdmin } from "@/lib/supabase/admin";

/** SPEC §14.1 — scheduled functions and utility events. */

export const retentionCleanupFn = inngest.createFunction(
  { id: "retention-cleanup" },
  { cron: "0 3 * * *" },
  async ({ step }) => step.run("cleanup", retentionCleanup),
);

export const expireCreditsFn = inngest.createFunction(
  { id: "expire-credits" },
  { cron: "*/30 * * * *" },
  async ({ step }) => step.run("expire", expireCreditsSweep),
);

export const resetViolationCountersFn = inngest.createFunction(
  { id: "reset-violation-counters" },
  { cron: "0 0 1 * *" },
  async ({ step }) => step.run("reset", resetViolationCounters),
);

export const sendEmailFn = inngest.createFunction(
  { id: "send-email", retries: 3 },
  { event: "email/send.requested" },
  async ({ event, step }) =>
    step.run("send", () =>
      sendTemplateEmail({ to: event.data.to, alias: event.data.alias as TemplateAlias, variables: event.data.variables }),
    ),
);

export const buildDownloadZipFn = inngest.createFunction(
  { id: "build-download-zip", retries: 1 },
  { event: "download/zip.requested" },
  async ({ event, step }) => step.run("build", () => buildDownloadZip(event.data.download_id)),
);

export const dataExportFn = inngest.createFunction(
  { id: "data-export", retries: 1 },
  { event: "account/export.requested" },
  async ({ event, step }) => step.run("export", () => buildDataExport(event.data.user_id)),
);

/** Normalises provider webhooks into `provider/job.completed` (SPEC §16.7). */
export const providerWebhookRelay = inngest.createFunction(
  { id: "provider-webhook-relay" },
  { event: "provider/webhook.received" },
  async ({ event, step }) => {
    const { provider, payload } = event.data;
    const providerJobId =
      (payload.request_id as string | undefined) ?? (payload.task_id as string | undefined) ?? (payload.id as string | undefined) ?? "";
    if (!providerJobId) return { ignored: true };
    await step.run("record", async () => {
      // Polling pipelines pick the result up on their next poll; we only log for observability.
      const { data: job } = await supabaseAdmin().from("jobs").select("id").eq("provider_job_id", providerJobId).maybeSingle();
      console.info(`[webhook:${provider}] provider job ${providerJobId} → job ${job?.id ?? "unknown"}`);
    });
    await step.sendEvent("completed", { name: "provider/job.completed", data: { provider, provider_job_id: providerJobId, payload } });
    return { providerJobId };
  },
);
