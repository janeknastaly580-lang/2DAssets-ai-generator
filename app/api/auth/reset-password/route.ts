import type { NextRequest } from "next/server";
import { handler, ok, parseJson, requireSameOrigin, ApiError } from "@/lib/api";
import { resetPasswordSchema } from "@/lib/validation/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { verifyAuthCode, findAuthUserByEmail } from "@/lib/auth/codes";

/** SPEC §5.3 step 4 — verify 8-digit code, set password, revoke all sessions. */
export const POST = handler(async (req: NextRequest) => {
  requireSameOrigin(req);
  const body = await parseJson(req, resetPasswordSchema);
  const res = await verifyAuthCode({ email: body.email, purpose: "password_reset", code: body.code });
  if (!res.ok) {
    const messages = {
      invalid: `Incorrect code${res.remaining != null ? ` — ${res.remaining} attempts left` : ""}`,
      expired: "This code has expired. Request a new one.",
      too_many_attempts: "Too many attempts. Request a new code.",
      not_found: "No active code for this email. Request a new one.",
    };
    throw new ApiError(res.reason, messages[res.reason], 400);
  }
  const user = res.userId
    ? (await supabaseAdmin().auth.admin.getUserById(res.userId)).data.user
    : await findAuthUserByEmail(body.email);
  if (!user) throw new ApiError("no_user", "Account not found", 400);
  const db = supabaseAdmin();
  const { error } = await db.auth.admin.updateUserById(user.id, { password: body.password, email_confirm: true });
  if (error) throw new ApiError("reset_failed", error.message, 400);
  await db.auth.admin.signOut(user.id, "global").catch(() => undefined);
  return ok({ next: "/login?reset=1" });
});
