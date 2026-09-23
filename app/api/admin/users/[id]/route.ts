import type { NextRequest } from "next/server";
import { handler, ok, parseJson, requireSameOrigin, requireAdmin, audit, getClientIp, ApiError } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { adminUserPatchSchema } from "@/lib/validation/misc";
import { sendTemplateEmail } from "@/lib/email/resend";
import { env } from "@/lib/env";
import { storage } from "@/lib/storage";

type Ctx = { params: Promise<{ id: string }> };

/** GET — full user detail: workspaces, ledger, jobs, moderation events (SPEC §19 Users). */
export const GET = handler(async (_req: NextRequest, { params }: Ctx) => {
  await requireAdmin();
  const { id } = await params;
  const db = supabaseAdmin();
  const { data: user } = await db.from("profiles").select("*").eq("id", id).maybeSingle();
  if (!user) throw new ApiError("not_found", "User not found", 404);
  const [{ data: memberships }, { data: jobs }, { data: events }] = await Promise.all([
    db.from("workspace_members").select("role, workspaces(*, credit_balances(*))").eq("user_id", id),
    db.from("jobs").select("id, type, status, credits_estimated, credits_charged, provider_cost_usd, error_code, created_at, workspace_id").eq("user_id", id).order("created_at", { ascending: false }).limit(50),
    db.from("moderation_events").select("*").eq("user_id", id).order("created_at", { ascending: false }).limit(50),
  ]);
  const wsIds = (memberships ?? []).map((m) => (m.workspaces as { id: string }).id);
  const { data: ledger } = wsIds.length
    ? await db.from("credit_ledger").select("*").in("workspace_id", wsIds).order("created_at", { ascending: false }).limit(100)
    : { data: [] };
  return ok({ user, memberships: memberships ?? [], jobs: jobs ?? [], moderation_events: events ?? [], ledger: ledger ?? [] });
});

/** PATCH — ban/unban, role, force sign-out. */
export const PATCH = handler(async (req: NextRequest, { params }: Ctx) => {
  requireSameOrigin(req);
  const admin = await requireAdmin();
  const { id } = await params;
  const body = await parseJson(req, adminUserPatchSchema);
  const db = supabaseAdmin();
  const { data: user } = await db.from("profiles").select("id, email, banned_at").eq("id", id).maybeSingle();
  if (!user) throw new ApiError("not_found", "User not found", 404);
  const ip = getClientIp(req);
  if (body.ban !== undefined) {
    if (body.ban) {
      await db.from("profiles").update({ banned_at: new Date().toISOString(), ban_reason: body.ban_reason ?? "admin" }).eq("id", id);
      await db.auth.admin.signOut(id, "global").catch(() => undefined);
      await sendTemplateEmail({ to: user.email, alias: "account-banned", variables: { REASON: body.ban_reason ?? "Violation of the Terms of Service", CONTACT_EMAIL: env.SUPPORT_EMAIL } }).catch(() => undefined);
      await audit(admin.userId, "admin.user.ban", { type: "user", id }, { reason: body.ban_reason }, ip);
    } else {
      await db.from("profiles").update({ banned_at: null, ban_reason: null }).eq("id", id);
      await audit(admin.userId, "admin.user.unban", { type: "user", id }, {}, ip);
    }
  }
  if (body.role) {
    if (id === admin.userId && body.role !== "admin") throw new ApiError("forbidden", "You cannot remove your own admin role", 400);
    await db.from("profiles").update({ role: body.role }).eq("id", id);
    await audit(admin.userId, "admin.user.role", { type: "user", id }, { role: body.role }, ip);
  }
  if (body.sign_out) {
    await db.auth.admin.signOut(id, "global").catch(() => undefined);
    await audit(admin.userId, "admin.user.signout", { type: "user", id }, {}, ip);
  }
  const { data } = await db.from("profiles").select("*").eq("id", id).single();
  return ok(data);
});

/** DELETE — GDPR delete (immediate). */
export const DELETE = handler(async (req: NextRequest, { params }: Ctx) => {
  requireSameOrigin(req);
  const admin = await requireAdmin();
  const { id } = await params;
  if (id === admin.userId) throw new ApiError("forbidden", "You cannot delete yourself", 400);
  const db = supabaseAdmin();
  const { data: wss } = await db.from("workspaces").select("id").eq("owner_id", id);
  for (const w of wss ?? []) await storage().deletePrefix(`ws/${w.id}/`).catch(() => undefined);
  await storage().deletePrefix(`users/${id}/`).catch(() => undefined);
  const { error } = await db.auth.admin.deleteUser(id);
  if (error) throw new ApiError("delete_failed", error.message, 400);
  await audit(admin.userId, "admin.user.delete", { type: "user", id }, {}, getClientIp(req));
  return ok({ deleted: id });
});
