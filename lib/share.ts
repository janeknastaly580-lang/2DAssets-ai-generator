import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { env } from "@/lib/env";

/** SPEC §18 — private share links: 32-byte base64url token, SHA-256 stored. */
export function newShareToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashShareToken(token) };
}

export function hashShareToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function shareUrl(token: string) {
  return `${env.APP_URL}/s/${token}`;
}

export async function resolveShareToken(token: string) {
  const { data } = await supabaseAdmin().from("share_links").select("*").eq("token_hash", hashShareToken(token)).maybeSingle();
  if (!data || data.revoked_at) return null;
  if (data.expires_at && new Date(data.expires_at).getTime() < Date.now()) return null;
  return data;
}

/** Invite tokens use the same scheme (SPEC §6.2). */
export const newInviteToken = newShareToken;
export const hashInviteToken = hashShareToken;
