import type { NextRequest } from "next/server";
import { handler, ok, parseJson, requireSameOrigin, getClientIp } from "@/lib/api";
import { forgotPasswordSchema } from "@/lib/validation/auth";
import { createAuthCode, findAuthUserByEmail } from "@/lib/auth/codes";
import { LIMITS, rateLimit } from "@/lib/auth/ratelimit";
import { sendTemplateEmail } from "@/lib/email/resend";

/** SPEC §5.3 — 8-digit reset code; response is always generic. */
export const POST = handler(async (req: NextRequest) => {
  requireSameOrigin(req);
  const ip = getClientIp(req);
  const body = await parseJson(req, forgotPasswordSchema);
  await rateLimit(`code:ip:${ip}`, LIMITS.codePerIp.window, LIMITS.codePerIp.limit);
  await rateLimit(`code:email:${body.email}`, LIMITS.codePerEmail.window, LIMITS.codePerEmail.limit);
  const started = Date.now();
  const user = await findAuthUserByEmail(body.email);
  if (user && user.email_confirmed_at) {
    const code = await createAuthCode({ email: body.email, userId: user.id, purpose: "password_reset", ip });
    await sendTemplateEmail({ to: body.email, alias: "preset", variables: { PRESET: code } });
  }
  const rest = 400 - (Date.now() - started);
  if (rest > 0) await new Promise((r) => setTimeout(r, rest));
  return ok({ message: "If an account exists for this email, we sent a code.", next: `/reset-password?email=${encodeURIComponent(body.email)}` });
});
