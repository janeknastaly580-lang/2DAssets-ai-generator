import { EventSchemas, Inngest } from "inngest";

/** Inngest event catalogue (SPEC §14.1). */
export type Events = {
  "asset/generate.requested": { data: { job_id: string; workspace_id: string } };
  "asset/generate.cancelled": { data: { job_id: string } };
  "provider/webhook.received": { data: { provider: "fal" | "worker"; payload: Record<string, unknown> } };
  "provider/job.completed": { data: { provider: string; provider_job_id: string; payload: Record<string, unknown> } };
  "download/zip.requested": { data: { download_id: string } };
  "email/send.requested": { data: { to: string; alias: string; variables: Record<string, string | number> } };
  "account/export.requested": { data: { user_id: string } };
};

export const inngest = new Inngest({
  id: "veyraflow",
  schemas: new EventSchemas().fromRecord<Events>(),
  eventKey: process.env.INNGEST_EVENT_KEY || undefined,
});
