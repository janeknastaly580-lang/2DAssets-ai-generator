import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ApiError } from "@/lib/api";

/**
 * Fixed-window rate limiter backed by `rate_limits` (SPEC §22).
 * Throws 429 when the limit is exceeded.
 */
export async function rateLimit(key: string, windowSeconds: number, limit: number) {
  const { data, error } = await supabaseAdmin().rpc("increment_rate_limit", {
    p_key: key,
    p_window_seconds: windowSeconds,
    p_limit: limit,
  });
  if (error) {
    console.error("[ratelimit]", error.message);
    return; // fail open rather than lock users out on a DB hiccup
  }
  if (data === false) throw new ApiError("rate_limited", "Too many requests. Please try again later.", 429);
}

export const LIMITS = {
  signupPerIp: { window: 3600, limit: 5 },
  codePerEmail: { window: 3600, limit: 5 },
  codePerIp: { window: 3600, limit: 20 },
  loginPerIpEmail: { window: 900, limit: 10 },
  jobsPerUser: { window: 3600, limit: 60 },
  sharePerIp: { window: 60, limit: 60 },
  uploadsPerUser: { window: 3600, limit: 30 },
  clientErrorsPerIp: { window: 60, limit: 20 },
} as const;
