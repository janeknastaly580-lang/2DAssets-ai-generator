import { NextResponse, type NextRequest } from "next/server";
import { getClientIp, handler, parseJson, requireSameOrigin } from "@/lib/api";
import { integrations } from "@/lib/env";
import { LIMITS, rateLimit } from "@/lib/auth/ratelimit";
import { reportErrorLater } from "@/lib/errorReporting";
import { supabaseServer } from "@/lib/supabase/server";
import { clientErrorSchema } from "@/lib/validation/misc";

async function currentUserId(): Promise<string | undefined> {
  try {
    const { data } = await (await supabaseServer()).auth.getUser();
    return data.user?.id;
  } catch {
    return undefined;
  }
}

/** POST /api/client-errors — browser errors → Google Cloud Error Reporting (SPEC §25.4). Answers 204. */
export const POST = handler(async (req: NextRequest) => {
  requireSameOrigin(req);
  if (!integrations.errorReporting) return new NextResponse(null, { status: 204 });
  if (integrations.supabaseAdmin) await rateLimit(`client_errors:${getClientIp(req)}`, LIMITS.clientErrorsPerIp.window, LIMITS.clientErrorsPerIp.limit);
  const body = await parseJson(req, clientErrorSchema);
  const name = body.name || "Error";
  const err = Object.assign(new Error(body.message), { name, stack: body.stack || `${name}: ${body.message}` });
  reportErrorLater(err, {
    source: "browser",
    where: `browser ${body.kind}`,
    userId: await currentUserId(),
    httpRequest: { url: body.url, userAgent: req.headers.get("user-agent") ?? undefined },
  });
  return new NextResponse(null, { status: 204 });
});
