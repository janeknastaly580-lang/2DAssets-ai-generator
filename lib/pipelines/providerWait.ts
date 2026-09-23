import "server-only";
import type { PollResult, ProviderAdapter } from "@/lib/ai/providers/types";
import { ProviderError } from "@/lib/ai/providers/types";
import type { PipelineContext } from "./types";

/**
 * submit → poll loop shared by all provider-backed pipelines (SPEC §8 step 5, §8.2 timeouts).
 * Persists the provider job id so a restarted run does not resubmit.
 */
export async function submitAndWait<In, Out>(
  ctx: PipelineContext<unknown>,
  adapter: ProviderAdapter<In, Out>,
  input: In,
  opts: { model: string; timeoutMs: number; pollMs?: number; progressBase?: number; progressSpan?: number },
): Promise<Out> {
  const res = await adapter.submit(input);
  if ("result" in res) return res.result;
  await ctx.setProviderJob(adapter.id, opts.model, res.providerJobId);
  if (!adapter.poll) throw new ProviderError("Adapter has no poll implementation");
  const started = Date.now();
  const pollMs = opts.pollMs ?? 5000;
  const base = opts.progressBase ?? 10;
  const span = opts.progressSpan ?? 70;
  for (;;) {
    await ctx.assertActive();
    if (Date.now() - started > opts.timeoutMs) throw new ProviderError("Provider timed out", "provider_timeout");
    const p: PollResult<Out> = await adapter.poll(res.providerJobId);
    if (p.status === "done" && p.result) return p.result;
    if (p.status === "error") {
      throw new ProviderError(p.error ?? "Provider failed", p.policyViolation ? "provider_policy" : "provider_error");
    }
    if (typeof p.progress === "number") await ctx.setProgress(Math.min(base + span, base + (p.progress / 100) * span));
    await ctx.rt.sleep(pollMs);
  }
}
