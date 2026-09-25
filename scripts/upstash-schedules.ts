/**
 * SPEC §14.1, §23.6 — creates or updates the QStash schedules that start the maintenance workflows
 * (retention-cleanup, expire-credits, reset-violation-counters). Idempotent: every schedule has a
 * fixed id (`veyraflow-<name>`), so running it again only updates cron/destination.
 *
 * Needs QSTASH_TOKEN (and optionally QSTASH_URL, EU by default) in .env.local and the public base URL
 * of the deployment the schedules should call:
 *   pnpm upstash:schedules https://veyraflow.eu
 * Run it only after the deployment has QSTASH_* variables — otherwise every run fails with 503.
 */
import { existsSync, readFileSync } from "node:fs";
import { Client } from "@upstash/qstash";
import { WORKFLOW_SCHEDULES, workflowPath } from "../lib/queue/names";

/** Minimal .env loader (.env then .env.local, later wins) — same order Next.js uses. */
function loadEnvFiles() {
  for (const file of [".env", ".env.local"]) {
    if (!existsSync(file)) continue;
    for (const raw of readFileSync(file, "utf8").split(/\r?\n/)) {
      const m = raw.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
      if (!m) continue;
      process.env[m[1]] = m[2].trim().replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1");
    }
  }
}
loadEnvFiles();

const baseUrl = (process.argv[2] ?? "").replace(/\/$/, "");
const token = process.env.QSTASH_TOKEN ?? "";
const qstashUrl = (process.env.QSTASH_URL || "https://qstash-eu-central-1.upstash.io").replace(/\/$/, "");

if (!/^https:\/\//.test(baseUrl)) {
  console.error("Usage: pnpm upstash:schedules https://<production-domain>  (QStash must reach it over HTTPS)");
  process.exit(1);
}
if (!token) {
  console.error("QSTASH_TOKEN is missing in .env.local");
  process.exit(1);
}

async function main() {
  const client = new Client({ baseUrl: qstashUrl, token });
  for (const { name, cron } of WORKFLOW_SCHEDULES) {
    const destination = `${baseUrl}${workflowPath(name)}`;
    const { scheduleId } = await client.schedules.create({ scheduleId: `veyraflow-${name}`, destination, cron, retries: 2 });
    console.log(`✓ ${scheduleId}  ${cron}  →  ${destination}`);
  }
  console.log(`Done (${qstashUrl}).`);
}

main().catch((e) => {
  console.error("Failed:", (e as Error).message);
  process.exit(1);
});
