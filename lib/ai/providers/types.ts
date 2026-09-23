/** SPEC §8.4 — common provider adapter contract. */
export type ProviderId = "fal" | "openai" | "worker" | "mock";

export type SubmitResult<Out> = { providerJobId: string } | { result: Out };

export interface PollResult<Out> {
  status: "pending" | "done" | "error";
  progress?: number;
  result?: Out;
  error?: string;
  /** provider reported a content-policy rejection (§12.1) */
  policyViolation?: boolean;
}

export interface ProviderAdapter<In, Out> {
  id: ProviderId;
  submit(input: In): Promise<SubmitResult<Out>>;
  poll?(providerJobId: string): Promise<PollResult<Out>>;
  estimateCostUsd(input: In): number;
}

export class ProviderError extends Error {
  constructor(
    message: string,
    public code: "provider_error" | "provider_policy" | "provider_timeout" | "not_riggable" = "provider_error",
  ) {
    super(message);
    this.name = "ProviderError";
  }
}

/** Fetch a provider result URL into memory. */
export async function fetchBuffer(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw new ProviderError(`Download failed (${res.status}) for provider file`);
  return Buffer.from(await res.arrayBuffer());
}

export function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
