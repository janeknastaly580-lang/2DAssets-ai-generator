import type { NextRequest } from "next/server";
import { z } from "zod";
import { handler, ok, parseJson, requireSameOrigin, ApiError } from "@/lib/api";
import { verifySignupSchema } from "@/lib/validation/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";
import { verifyAuthCode, findAuthUserByEmail } from "@/lib/auth/codes";

const schema = verifySignupSchema.extend({ password: z.string().min(10).max(128).optional() });

/** SPEC §5.1 step 4 — confirm e-mail, then create a session (cookies) and redirect to /app. */
export const POST = handler(async (req: NextRequest) => {
  requireSameOrigin(req);
  const body = await parseJson(req, schema);
  const res = await verifyAuthCode({ email: body.email, purpose: "signup", code: body.code });
  if (!res.ok) {
    const map = {
      invalid: ["invalid_code", `Incorrect code${res.remaining != null ? ` — ${res.remaining} attempts left` : ""}`],
      expired: ["code_expired", "This code has expired. Request a new one."],
      too_many_attempts: ["too_many_attempts", "Too many attempts. Request a new code."],
      not_found: ["code_not_found", "No active code for this email. Request a new one."],
    } as const;
    const [code, message] = map[res.reason];
    throw new ApiError(code, message, 400);
  }
  const user = res.userId
    ? (await supabaseAdmin().auth.admin.getUserById(res.userId)).data.user
    : await findAuthUserByEmail(body.email);
  if (!user) throw new ApiError("no_user", "Account not found", 400);
  await supabaseAdmin().auth.admin.updateUserById(user.id, { email_confirm: true });

  // The signup page keeps the password in memory and passes it here so we can open a session
  // right away; if it is missing (page reload), the user signs in on /login.
  if (body.password) {
    const supabase = await supabaseServer();
    const { error } = await supabase.auth.signInWithPassword({ email: body.email, password: body.password });
    if (!error) return ok({ next: "/app" });
  }
  return ok({ next: "/login?verified=1" });
});
