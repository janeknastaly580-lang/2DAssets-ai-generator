/**
 * Upstash Workflow names and schedules (SPEC §14.1). No server-only imports: also used by
 * `scripts/upstash-schedules.ts`.
 */
export const WORKFLOW_NAMES = [
  "generate-asset",
  "build-download-zip",
  "data-export",
  "retention-cleanup",
  "expire-credits",
  "reset-violation-counters",
] as const;
export type WorkflowName = (typeof WORKFLOW_NAMES)[number];

/** Scheduled workflows (UTC). Synced to QStash schedules with fixed ids by `pnpm upstash:schedules`. */
export const WORKFLOW_SCHEDULES: { name: WorkflowName; cron: string }[] = [
  { name: "retention-cleanup", cron: "0 3 * * *" },
  { name: "expire-credits", cron: "*/30 * * * *" },
  { name: "reset-violation-counters", cron: "0 0 1 * *" },
];

export function workflowPath(name: WorkflowName) {
  return `/api/workflow/${name}`;
}
