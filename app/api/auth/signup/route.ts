import type { NextRequest } from "next/server";
import { handler, ok, parseJson, requireSameOrigin, getClientIp, ApiError } from "@/lib/api";
import { signupSchema } from "@/lib/validation/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createAuthCode, findAuthUserByEmail } from "@/lib/auth/codes";
import { LIMITS, rateLimit } from "@/lib/auth/ratelimit";
import { sendTemplateEmail } from "@/lib/email/resend";
import { env } from "@/lib/env";
import { isFlagEnabled } from "@/lib/flags";

const GENERIC = { message: "If this email is new, we sent a verification code." };

/** SPEC §5.1 — registration with a 6-digit code (our backend, not Supabase built-in e-mails). */
export const POST = handler(async (req: NextRequest) => {
  requireSameOrigin(req);
  const ip = getClientIp(req);
  await rateLimit(`signup:ip:${ip}`, LIMITS.signupPerIp.window, LIMITS.signupPerIp.limit);
  const body = await parseJson(req, signupSchema);
  if (!(await isFlagEnabled("signup_enabled", true))) throw new ApiError("signup_disabled", "Sign-ups are temporarily disabled", 503);
  await rateLimit(`code:email:${body.email}`, LIMITS.codePerEmail.window, LIMITS.codePerEmail.limit);

  const started = Date.now();
  const db = supabaseAdmin();
  const existing = await findAuthUserByEmail(body.email);
  let userId: string | null = null;
  if (existing) {
    if (existing.email_confirmed_at) {
      await padTiming(started);
      return ok(GENERIC); // no account enumeration
    }
    await db.auth.admin.updateUserById(existing.id, { password: body.password });
    userId = existing.id;
  } else {
    const { data, error } = await db.auth.admin.createUser({
      email: body.email,
      password: body.password,
      email_confirm: false,
      user_metadata: { tos_version: env.TOS_VERSION, marketing_consent: body.marketing_consent },
    });
    if (error || !data.user) throw new ApiError("signup_failed", error?.message ?? "Could not create account", 400);
    userId = data.user.id;
  }
  const code = await createAuthCode({ email: body.email, userId, purpose: "signup", ip });
  await sendTemplateEmail({ to: body.email, alias: "signin", variables: { CODE: code } });
  await padTiming(started);
  return ok({ ...GENERIC, next: `/verify?email=${encodeURIComponent(body.email)}` });
});

async function padTiming(started: number, minMs = 400) {
  const rest = minMs - (Date.now() - started);
  if (rest > 0) await new Promise((r) => setTimeout(r, rest));
}
