import { describe, expect, it, vi } from "vitest";
import type { PollResult, ProviderAdapter } from "@/lib/ai/providers/types";
import { submitAndWait } from "@/lib/pipelines/providerWait";
import { PipelineYield, type PipelineContext, type ProviderCallState } from "@/lib/pipelines/types";

// SPEC §8, §14.1 — provider requests are checkpointed so a workflow chunk can yield before Vercel's
// 300 s limit and the next chunk resumes polling instead of resubmitting (and paying twice).

function makeCtx(opts: { deadline?: number; saved?: Record<string, ProviderCallState> } = {}) {
  let calls: Record<string, ProviderCallState> = { ...(opts.saved ?? {}) };
  let index = 0;
  const ctx = {
    rt: { sleep: async () => undefined, log: () => undefined, deadline: opts.deadline },
    setProgress: async () => undefined,
    assertActive: async () => undefined,
    setProviderJob: vi.fn(async () => undefined),
    providerCalls: {
      nextKey: (model: string) => `${index++}:${model}`,
      get: (key: string) => calls[key],
      save: async (key: string, state: ProviderCallState) => {
        calls = { ...calls, [key]: state };
      },
    },
  } as unknown as PipelineContext<unknown>;
  return { ctx, calls: () => calls };
}

function makeAdapter(polls: PollResult<{ url: string }>[]) {
  const adapter = {
    id: "fal" as const,
    submit: vi.fn(async () => ({ providerJobId: "req-1" })),
    poll: vi.fn(async () => polls.shift() ?? { status: "pending" as const }),
    estimateCostUsd: () => 0,
  } satisfies ProviderAdapter<unknown, { url: string }>;
  return adapter;
}

const opts = { model: "fal-ai/rodin", timeoutMs: 60_000, pollMs: 1000 };

describe("submitAndWait checkpoints", () => {
  it("yields at the deadline and keeps the submitted request id", async () => {
    const { ctx, calls } = makeCtx({ deadline: Date.now() + 500 });
    const adapter = makeAdapter([{ status: "pending" }]);
    await expect(submitAndWait(ctx, adapter, {}, opts)).rejects.toBeInstanceOf(PipelineYield);
    expect(adapter.submit).toHaveBeenCalledTimes(1);
    expect(calls()["0:fal-ai/rodin"]).toMatchObject({ id: "req-1", provider: "fal" });
    expect(calls()["0:fal-ai/rodin"].done).toBeUndefined();
  });

  it("resumes polling the saved request instead of submitting again", async () => {
    const saved = { "0:fal-ai/rodin": { provider: "fal", model: "fal-ai/rodin", id: "req-1", submitted_at: new Date().toISOString() } };
    const { ctx, calls } = makeCtx({ saved });
    const adapter = makeAdapter([{ status: "pending" }, { status: "done", result: { url: "https://x/y.glb" } }]);
    await expect(submitAndWait(ctx, adapter, {}, opts)).resolves.toEqual({ url: "https://x/y.glb" });
    expect(adapter.submit).not.toHaveBeenCalled();
    expect(adapter.poll).toHaveBeenCalledWith("req-1");
    expect(calls()["0:fal-ai/rodin"]).toMatchObject({ done: true, result: { url: "https://x/y.glb" } });
  });

  it("reuses a finished result without calling the provider", async () => {
    const saved = {
      "0:fal-ai/rodin": { provider: "fal", model: "fal-ai/rodin", id: "req-1", submitted_at: new Date().toISOString(), done: true, result: { url: "u" } },
    };
    const { ctx } = makeCtx({ saved });
    const adapter = makeAdapter([]);
    await expect(submitAndWait(ctx, adapter, {}, opts)).resolves.toEqual({ url: "u" });
    expect(adapter.submit).not.toHaveBeenCalled();
    expect(adapter.poll).not.toHaveBeenCalled();
  });

  it("measures the provider timeout from the original submission, across resumes", async () => {
    const saved = { "0:fal-ai/rodin": { provider: "fal", model: "fal-ai/rodin", id: "req-1", submitted_at: new Date(Date.now() - 120_000).toISOString() } };
    const { ctx } = makeCtx({ saved });
    await expect(submitAndWait(ctx, makeAdapter([]), {}, opts)).rejects.toMatchObject({ code: "provider_timeout" });
  });

  it("gives each sequential request its own checkpoint", async () => {
    const { ctx, calls } = makeCtx();
    const first = makeAdapter([{ status: "done", result: { url: "a" } }]);
    const second = makeAdapter([{ status: "done", result: { url: "b" } }]);
    await submitAndWait(ctx, first, {}, opts);
    await submitAndWait(ctx, second, {}, { ...opts, model: "blender" });
    expect(Object.keys(calls())).toEqual(["0:fal-ai/rodin", "1:blender"]);
  });
});
