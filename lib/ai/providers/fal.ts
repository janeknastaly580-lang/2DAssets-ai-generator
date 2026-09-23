import "server-only";
import { ApiError, createFalClient, type FalClient } from "@fal-ai/client";
import { env } from "@/lib/env";
import { estimateFalCostUsd } from "@/lib/ai/falModels";
import { ProviderError, type PollResult, type ProviderAdapter, type SubmitResult } from "./types";

/**
 * fal.ai adapter (SPEC §9.7) on the official `@fal-ai/client`, following the "Queue" flow of fal's
 * model docs: `queue.submit` → `queue.status` → `queue.result`. The adapter is bound to one endpoint,
 * so polling needs only the request id persisted in `jobs.provider_job_id` — no in-process state,
 * a restarted run resumes polling. Authenticated with FAL_KEY (server-side only).
 */
export interface FalOutput {
  requestId: string;
  data: Record<string, unknown>;
}

let client: FalClient | null = null;

function fal(): FalClient {
  if (!env.FAL_KEY) throw new ProviderError("FAL_KEY is not configured");
  client ??= createFalClient({ credentials: env.FAL_KEY });
  return client;
}

function toProviderError(e: unknown, what: string): ProviderError {
  if (e instanceof ProviderError) return e;
  if (e instanceof ApiError) {
    const body = typeof e.body === "string" ? e.body : JSON.stringify(e.body ?? "");
    if (/content[_ ]?policy|nsfw|safety/i.test(body)) return new ProviderError(`fal.ai ${what}: content policy`, "provider_policy");
    return new ProviderError(`fal.ai ${what} failed (${e.status}): ${(body || e.message).slice(0, 300)}`);
  }
  return new ProviderError(`fal.ai ${what}: ${e instanceof Error ? e.message : String(e)}`);
}

/** Network hiccups, rate limits and 5xx are retried by the poll loop instead of failing the job. */
function isTransient(e: unknown): boolean {
  return !(e instanceof ApiError) || e.status === 429 || e.status >= 500;
}

export function falEndpoint(endpoint: string): ProviderAdapter<Record<string, unknown>, FalOutput> {
  return {
    id: "fal",
    async submit(input): Promise<SubmitResult<FalOutput>> {
      try {
        const res = await fal().queue.submit(endpoint, { input });
        return { providerJobId: res.request_id };
      } catch (e) {
        throw toProviderError(e, endpoint);
      }
    },
    async poll(requestId): Promise<PollResult<FalOutput>> {
      let status;
      try {
        status = await fal().queue.status(endpoint, { requestId, logs: false });
      } catch (e) {
        if (isTransient(e)) return { status: "pending" };
        throw toProviderError(e, endpoint);
      }
      if (status.status !== "COMPLETED") return { status: "pending", progress: status.status === "IN_PROGRESS" ? 50 : 5 };
      try {
        const res = await fal().queue.result(endpoint, { requestId });
        return { status: "done", result: { requestId, data: (res.data ?? {}) as Record<string, unknown> } };
      } catch (e) {
        if (isTransient(e)) return { status: "pending", progress: 95 };
        const err = toProviderError(e, endpoint);
        return { status: "error", error: err.message, policyViolation: err.code === "provider_policy" };
      }
    },
    estimateCostUsd: (input) => estimateFalCostUsd(endpoint, input),
  };
}

/**
 * Uploads an input file to fal storage (docs "Files → Uploading files") and returns a URL fal can
 * fetch. Needed because our own presigned URLs point at localhost when storage is the local disk.
 */
export async function uploadToFal(body: Buffer, contentType: string): Promise<string> {
  try {
    return await fal().storage.upload(new Blob([new Uint8Array(body)], { type: contentType }));
  } catch (e) {
    throw toProviderError(e, "storage upload");
  }
}
