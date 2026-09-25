import { serveMany } from "@upstash/workflow/nextjs";
import { env, integrations } from "@/lib/env";
import { qstashClient, qstashReceiver } from "@/lib/queue/upstash";
import { workflows } from "@/lib/queue/workflows";

/**
 * SPEC §14.1 — Upstash Workflow endpoint: POST /api/workflow/<name>, one route for every workflow.
 * Requests are verified with the QStash signing keys; production refuses to run without them.
 * Vercel: maxDuration 300 (Fluid compute) — pipeline steps yield after 180 s (lib/queue/workflows.ts).
 */
export const maxDuration = 300;

let served: ReturnType<typeof serveMany> | undefined;

export async function POST(request: Request) {
  if (!integrations.queue) {
    return Response.json({ ok: false, error: { code: "queue_disabled", message: "QSTASH_TOKEN is not set" } }, { status: 503 });
  }
  if (!integrations.queueSigning && !env.IS_DEV) {
    return Response.json({ ok: false, error: { code: "queue_unsigned", message: "QStash signing keys are not set" } }, { status: 503 });
  }
  // Checked here as well so that forged requests get a bare 401 (the SDK answers 500 with a stack trace).
  if (integrations.queueSigning) {
    const signature = request.headers.get("upstash-signature") ?? "";
    const valid = signature && (await qstashReceiver().verify({ signature, body: await request.clone().text() }).catch(() => false));
    if (!valid) return Response.json({ ok: false, error: { code: "invalid_signature" } }, { status: 401 });
  }
  served ??= serveMany(workflows, {
    qstashClient: qstashClient(),
    receiver: integrations.queueSigning ? qstashReceiver() : undefined,
    disableTelemetry: true,
  });
  return served.POST(request);
}
