import "server-only";
import { Client as QStashClient, Receiver } from "@upstash/qstash";
import { Client as WorkflowClient } from "@upstash/workflow";
import { env } from "@/lib/env";
import { workflowPath, type WorkflowName } from "./names";

export type { WorkflowName } from "./names";

/**
 * Upstash Workflow plumbing (SPEC §14.1). Region comes from QSTASH_URL (EU by default); the token
 * and signing keys belong to that region's QStash user.
 */
export function workflowUrl(name: WorkflowName, baseUrl = env.UPSTASH_WORKFLOW_URL || env.APP_URL): string {
  return `${baseUrl.replace(/\/$/, "")}${workflowPath(name)}`;
}

export function workflowClient() {
  return new WorkflowClient({ baseUrl: env.QSTASH_URL, token: env.QSTASH_TOKEN });
}

/** Client the workflow endpoint uses to publish its next steps. */
export function qstashClient() {
  return new QStashClient({ baseUrl: env.QSTASH_URL, token: env.QSTASH_TOKEN });
}

export function qstashReceiver() {
  return new Receiver({ currentSigningKey: env.QSTASH_CURRENT_SIGNING_KEY, nextSigningKey: env.QSTASH_NEXT_SIGNING_KEY });
}
