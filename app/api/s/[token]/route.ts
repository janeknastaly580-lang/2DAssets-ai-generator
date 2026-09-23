import type { NextRequest } from "next/server";
import { handler, ok, getClientIp, ApiError } from "@/lib/api";
import { LIMITS, rateLimit } from "@/lib/auth/ratelimit";
import { getSharePayload } from "@/lib/sharePublic";

/** GET /api/s/:token — public share payload, 60/min/IP (SPEC §18). */
export const GET = handler(async (req: NextRequest, { params }: { params: Promise<{ token: string }> }) => {
  const { token } = await params;
  await rateLimit(`share:ip:${getClientIp(req)}`, LIMITS.sharePerIp.window, LIMITS.sharePerIp.limit);
  const payload = await getSharePayload(token, { countView: true });
  if (!payload) throw new ApiError("not_found", "This link is no longer available", 404);
  return ok(payload, { headers: { "X-Robots-Tag": "noindex" } });
});
