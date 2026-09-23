import "server-only";
import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import type { Database } from "@/lib/supabase/database.types";

type Purpose = Database["public"]["Enums"]["auth_code_purpose"];

/** SPEC §5 / §22 — CSPRNG numeric codes, SHA-256(code + pepper), constant-time compare. */
export const CODE_CONFIG: Record<Purpose, { digits: number; ttlMinutes: number }> = {
  signup: { digits: 6, ttlMinutes: 10 },
  password_reset: { digits: 8, ttlMinutes: 15 },
};

export function generateCode(digits: number): string {
  let out = "";
  for (let i = 0; i < digits; i++) out += String(randomInt(0, 10));
  return out;
}

export function hashCode(code: string): string {
  return createHash("sha256").update(code + env.AUTH_CODE_PEPPER).digest("hex");
}

export async function createAuthCode(opts: { email: string; userId: string | null; purpose: Purpose; ip?: string }) {
  const cfg = CODE_CONFIG[opts.purpose];
  const code = generateCode(cfg.digits);
  const db = supabaseAdmin();
  const email = opts.email.toLowerCase();
  // one active code per (email, purpose): invalidate previous
  await db
    .from("auth_codes")
    .update({ consumed_at: new Date().toISOString() })
    .eq("email", email)
    .eq("purpose", opts.purpose)
    .is("consumed_at", null);
  const { error } = await db.from("auth_codes").insert({
    email,
    user_id: opts.userId,
    purpose: opts.purpose,
    code_hash: hashCode(code),
    expires_at: new Date(Date.now() + cfg.ttlMinutes * 60_000).toISOString(),
    max_attempts: 5,
    ip: opts.ip ?? null,
  });
  if (error) throw error;
  return code;
}

export type VerifyResult =
  | { ok: true; userId: string | null }
  | { ok: false; reason: "invalid" | "expired" | "too_many_attempts" | "not_found"; remaining?: number };

export async function verifyAuthCode(opts: { email: string; purpose: Purpose; code: string }): Promise<VerifyResult> {
  const db = supabaseAdmin();
  const email = opts.email.toLowerCase();
  const { data: row } = await db
    .from("auth_codes")
    .select("*")
    .eq("email", email)
    .eq("purpose", opts.purpose)
    .is("consumed_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!row) return { ok: false, reason: "not_found" };
  if (new Date(row.expires_at).getTime() < Date.now()) return { ok: false, reason: "expired" };
  if (row.attempts >= row.max_attempts) return { ok: false, reason: "too_many_attempts" };

  const a = Buffer.from(hashCode(opts.code));
  const b = Buffer.from(row.code_hash);
  const match = a.length === b.length && timingSafeEqual(a, b);
  if (!match) {
    const attempts = row.attempts + 1;
    const exhausted = attempts >= row.max_attempts;
    await db
      .from("auth_codes")
      .update({ attempts, consumed_at: exhausted ? new Date().toISOString() : null })
      .eq("id", row.id);
    return exhausted
      ? { ok: false, reason: "too_many_attempts" }
      : { ok: false, reason: "invalid", remaining: row.max_attempts - attempts };
  }
  await db.from("auth_codes").update({ consumed_at: new Date().toISOString() }).eq("id", row.id);
  return { ok: true, userId: row.user_id };
}

/** Last code sent for (email, purpose) — used for the 60 s resend cooldown. */
export async function lastCodeSentAt(email: string, purpose: Purpose): Promise<Date | null> {
  const { data } = await supabaseAdmin()
    .from("auth_codes")
    .select("created_at")
    .eq("email", email.toLowerCase())
    .eq("purpose", purpose)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ? new Date(data.created_at) : null;
}

/**
 * Find an auth user by e-mail (server only, never exposed to the client).
 * `profiles` is created by the `handle_new_user` trigger for every auth user, so it is a reliable index.
 */
export async function findAuthUserByEmail(email: string) {
  const db = supabaseAdmin();
  const { data: profile } = await db.from("profiles").select("id").eq("email", email.toLowerCase()).maybeSingle();
  if (!profile) return null;
  const { data } = await db.auth.admin.getUserById(profile.id);
  return data.user ?? null;
}
