import "server-only";
import type { PollResult, ProviderAdapter } from "@/lib/ai/providers/types";
import { ProviderError } from "@/lib/ai/providers/types";
import { PipelineYield, type PipelineContext } from "./types";

/**
 * submit → poll loop shared by all provider-backed pipelines (SPEC §8 step 5, §8.2 timeouts).
 * Every request is checkpointed in `jobs.provider_calls`: a resumed run polls the request it already
 * submitted (or reuses its result) instead of resubmitting and paying twice. When the runtime
 * deadline is near, it throws `PipelineYield` and the next workflow step continues polling.
 */
export async function submitAndWait<In, Out>(
  ctx: PipelineContext<unknown>,
  adapter: ProviderAdapter<In, Out>,
  input: In,
  opts: { model: string; timeoutMs: number; pollMs?: number; progressBase?: number; progressSpan?: number },
): Promise<Out> {
  const key = ctx.providerCalls.nextKey(opts.model);
  const saved = ctx.providerCalls.get(key);
  if (saved?.done) return saved.result as Out;

  let providerJobId = saved?.id ?? null;
  const submittedAt = saved?.submitted_at ?? new Date().toISOString();
  if (!providerJobId) {
    const res = await adapter.submit(input);
    const base = { provider: adapter.id, model: opts.model, submitted_at: submittedAt };
    if ("result" in res) {
      await ctx.providerCalls.save(key, { ...base, id: null, done: true, result: res.result });
      return res.result;
    }
    providerJobId = res.providerJobId;
    await ctx.setProviderJob(adapter.id, opts.model, providerJobId);
    await ctx.providerCalls.save(key, { ...base, id: providerJobId });
  }
  if (!adapter.poll) throw new ProviderError("Adapter has no poll implementation");

  const started = Date.parse(submittedAt);
  const pollMs = opts.pollMs ?? 5000;
  const base = opts.progressBase ?? 10;
  const span = opts.progressSpan ?? 70;
  for (;;) {
    await ctx.assertActive();
    if (Date.now() - started > opts.timeoutMs) throw new ProviderError("Provider timed out", "provider_timeout");
    const p: PollResult<Out> = await adapter.poll(providerJobId);
    if (p.status === "done" && p.result) {
      await ctx.providerCalls.save(key, { provider: adapter.id, model: opts.model, id: providerJobId, submitted_at: submittedAt, done: true, result: p.result });
      return p.result;
    }
    if (p.status === "error") {
      throw new ProviderError(p.error ?? "Provider failed", p.policyViolation ? "provider_policy" : "provider_error");
    }
    if (typeof p.progress === "number") await ctx.setProgress(Math.min(base + span, base + (p.progress / 100) * span));
    if (ctx.rt.deadline && Date.now() + pollMs > ctx.rt.deadline) throw new PipelineYield();
    await ctx.rt.sleep(pollMs);
  }
}
