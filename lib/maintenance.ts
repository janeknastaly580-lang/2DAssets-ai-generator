import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { storage } from "@/lib/storage";
import { adjustStorage, expireCredits } from "@/lib/credits/ledger";
import { sendTemplateEmail } from "@/lib/email/resend";
import { env } from "@/lib/env";
import { TRASH_DAYS } from "@/lib/plans";

/**
 * Scheduled maintenance tasks (SPEC §13, §14.1). Called by Upstash scheduled workflows in production and by
 * `POST /api/admin/maintenance` (admin) or `pnpm tsx scripts/maintenance.ts` locally.
 */

/** §13 retention: warn 7 days before expiry, soft-delete expired, hard-delete after trash period. */
export async function retentionCleanup(): Promise<{ warned: number; softDeleted: number; hardDeleted: number }> {
  const db = supabaseAdmin();
  const now = Date.now();
  const soon = new Date(now + 7 * 86_400_000).toISOString();

  // warn (group by user; once per asset via metadata flag)
  const { data: expiring } = await db
    .from("assets")
    .select("id, workspace_id, expires_at, created_by, metadata")
    .is("deleted_at", null)
    .not("expires_at", "is", null)
    .lte("expires_at", soon)
    .gt("expires_at", new Date(now).toISOString());
  const byUser = new Map<string, { count: number; earliest: string }>();
  let warned = 0;
  for (const a of expiring ?? []) {
    const meta = (a.metadata ?? {}) as Record<string, unknown>;
    if (meta.expiry_warned || !a.created_by) continue;
    const cur = byUser.get(a.created_by) ?? { count: 0, earliest: a.expires_at! };
    cur.count++;
    if (a.expires_at! < cur.earliest) cur.earliest = a.expires_at!;
    byUser.set(a.created_by, cur);
    await db.from("assets").update({ metadata: { ...meta, expiry_warned: true } as never }).eq("id", a.id);
    warned++;
  }
  for (const [userId, info] of byUser) {
    const { data: p } = await db.from("profiles").select("email, notification_prefs").eq("id", userId).single();
    const prefs = (p?.notification_prefs ?? {}) as { assets_expiring?: boolean };
    if (!p || prefs.assets_expiring === false) continue;
    await sendTemplateEmail({
      to: p.email,
      alias: "assets-expiring",
      variables: { COUNT: info.count, EXPIRES_AT: new Date(info.earliest).toDateString(), LIBRARY_URL: `${env.APP_URL}/app/library` },
    }).catch(() => undefined);
  }

  // soft delete expired
  const { data: expired } = await db
    .from("assets")
    .select("id")
    .is("deleted_at", null)
    .not("expires_at", "is", null)
    .lte("expires_at", new Date(now).toISOString());
  const softIds = (expired ?? []).map((a) => a.id);
  if (softIds.length) await db.from("assets").update({ deleted_at: new Date().toISOString() }).in("id", softIds);

  // hard delete after trash period (7 days after expiry soft delete; 14 days for user trash — use the larger window)
  const cutoff = new Date(now - TRASH_DAYS * 86_400_000).toISOString();
  const { data: toPurge } = await db
    .from("assets")
    .select("id, workspace_id, project_id, size_bytes")
    .not("deleted_at", "is", null)
    .lte("deleted_at", cutoff)
    .limit(200);
  let hardDeleted = 0;
  for (const a of toPurge ?? []) {
    await storage().deletePrefix(`ws/${a.workspace_id}/proj/${a.project_id}/asset/${a.id}/`);
    await adjustStorage(a.workspace_id, -a.size_bytes);
    await db.from("assets").delete().eq("id", a.id);
    hardDeleted++;
  }
  // temporary uploads / downloads
  const { data: oldUploads } = await db.from("uploads").select("id, r2_key").lte("expires_at", new Date(now).toISOString()).limit(500);
  for (const u of oldUploads ?? []) {
    await storage().delete(u.r2_key).catch(() => undefined);
    await db.from("uploads").delete().eq("id", u.id);
  }
  const { data: oldDownloads } = await db.from("downloads").select("id, r2_key").lte("expires_at", new Date(now).toISOString()).limit(500);
  for (const d of oldDownloads ?? []) {
    if (d.r2_key) await storage().delete(d.r2_key).catch(() => undefined);
    await db.from("downloads").delete().eq("id", d.id);
  }
  return { warned, softDeleted: softIds.length, hardDeleted };
}

/** §14.1 expire-credits: trial after 30 days, subscription after the 3-day buffer without a paid invoice. */
export async function expireCreditsSweep(): Promise<{ trial: number; subscription: number }> {
  const db = supabaseAdmin();
  const now = new Date().toISOString();
  const { data: trials } = await db.from("credit_balances").select("workspace_id").gt("trial_available", 0).lte("trial_expires_at", now);
  for (const t of trials ?? []) await expireCredits(t.workspace_id, "trial");
  const { data: subs } = await db
    .from("credit_balances")
    .select("workspace_id")
    .gt("subscription_available", 0)
    .lte("subscription_expires_at", now);
  for (const s of subs ?? []) await expireCredits(s.workspace_id, "subscription");
  return { trial: trials?.length ?? 0, subscription: subs?.length ?? 0 };
}

/** §12.2 reset-violation-counters (1st of month UTC). */
export async function resetViolationCounters(): Promise<void> {
  await supabaseAdmin().from("profiles").update({ violations_month: 0 }).gt("violations_month", 0);
}

