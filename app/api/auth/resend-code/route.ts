import type { NextRequest } from "next/server";
import { handler, ok, parseJson, requireSameOrigin, getClientIp, ApiError } from "@/lib/api";
import { resendCodeSchema } from "@/lib/validation/auth";
import { createAuthCode, findAuthUserByEmail, lastCodeSentAt } from "@/lib/auth/codes";
import { LIMITS, rateLimit } from "@/lib/auth/ratelimit";
import { sendTemplateEmail } from "@/lib/email/resend";

/** SPEC §16.1 — resend a code with a 60 s cooldown and 5/h/e-mail limit. */
export const POST = handler(async (req: NextRequest) => {
  requireSameOrigin(req);
  const ip = getClientIp(req);
  const body = await parseJson(req, resendCodeSchema);
  await rateLimit(`code:ip:${ip}`, LIMITS.codePerIp.window, LIMITS.codePerIp.limit);
  const last = await lastCodeSentAt(body.email, body.purpose);
  if (last && Date.now() - last.getTime() < 60_000) {
    throw new ApiError("cooldown", "Please wait a minute before requesting another code", 429);
  }
  await rateLimit(`code:email:${body.email}`, LIMITS.codePerEmail.window, LIMITS.codePerEmail.limit);

  const user = await findAuthUserByEmail(body.email);
  const generic = { message: "If an account exists for this email, we sent a new code." };
  if (!user) return ok(generic);
  if (body.purpose === "signup" && user.email_confirmed_at) return ok(generic);

  const code = await createAuthCode({ email: body.email, userId: user.id, purpose: body.purpose, ip });
  if (body.purpose === "signup") await sendTemplateEmail({ to: body.email, alias: "signin", variables: { CODE: code } });
  else await sendTemplateEmail({ to: body.email, alias: "preset", variables: { PRESET: code } });
  return ok(generic);
});
