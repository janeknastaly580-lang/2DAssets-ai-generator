import type { NextRequest } from "next/server";
import { z } from "zod";
import { handler, ok, parseJson, requireSameOrigin, requireUser, audit, ApiError } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";
import { updateProfileSchema } from "@/lib/validation/misc";
import { passwordSchema } from "@/lib/validation/auth";
import { deleteUserFiles, storage } from "@/lib/storage";
import { env } from "@/lib/env";
import { sendTemplateEmail } from "@/lib/email/resend";
import { dispatchDataExport } from "@/lib/queue/dispatch";
import type { Database } from "@/lib/supabase/database.types";

/** GET /api/account — profile + avatar URL. */
export const GET = handler(async () => {
  const { profile } = await requireUser();
  const avatar_url = profile.avatar_key ? await storage().presignGet(profile.avatar_key, { inline: true, ttl: 3600 }) : null;
  return ok({ ...profile, avatar_url, tos_current: env.TOS_VERSION });
});

/** PATCH /api/account — display name, marketing consent, notification prefs (SPEC §5.4). */
export const PATCH = handler(async (req: NextRequest) => {
  requireSameOrigin(req);
  const { userId, profile } = await requireUser();
  const body = await parseJson(req, updateProfileSchema);
  const patch: Database["public"]["Tables"]["profiles"]["Update"] = {};
  if (body.display_name !== undefined) patch.display_name = body.display_name;
  if (body.marketing_consent !== undefined) patch.marketing_consent = body.marketing_consent;
  if (body.notification_prefs) {
    patch.notification_prefs = { ...((profile.notification_prefs as object) ?? {}), ...body.notification_prefs } as never;
  }
  const { data, error } = await supabaseAdmin().from("profiles").update(patch).eq("id", userId).select("*").single();
  if (error) throw error;
  if (body.display_name) {
    await supabaseAdmin().from("workspaces").update({ name: body.display_name }).eq("owner_id", userId).eq("type", "personal");
  }
  return ok(data);
});

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("change_password"), current: z.string().min(1), password: passwordSchema, confirm: z.string() }),
  z.object({ action: z.literal("accept_tos") }),
  z.object({ action: z.literal("cookie_consent"), consent: z.object({ analytics: z.boolean(), marketing: z.boolean() }) }),
  z.object({ action: z.literal("sign_out_everywhere") }),
  z.object({ action: z.literal("request_export") }),
  z.object({ action: z.literal("delete_account"), email: z.string().trim().min(1).max(320) }),
]);

/** POST /api/account — account actions (SPEC §5.4, §21.3–§21.5). */
export const POST = handler(async (req: NextRequest) => {
  requireSameOrigin(req);
  const { userId, email } = await requireUser();
  const body = await parseJson(req, actionSchema);
  const db = supabaseAdmin();
  switch (body.action) {
    case "change_password": {
      if (body.password !== body.confirm) throw new ApiError("mismatch", "Passwords do not match", 400);
      const supabase = await supabaseServer();
      const { error: bad } = await supabase.auth.signInWithPassword({ email, password: body.current });
      if (bad) throw new ApiError("wrong_password", "Current password is incorrect", 400);
      const { error } = await db.auth.admin.updateUserById(userId, { password: body.password });
      if (error) throw new ApiError("update_failed", error.message, 400);
      await audit(userId, "account.password.change", { type: "user", id: userId });
      return ok({ changed: true });
    }
    case "accept_tos": {
      await db.from("profiles").update({ tos_accepted_at: new Date().toISOString(), tos_version: env.TOS_VERSION }).eq("id", userId);
      return ok({ tos_version: env.TOS_VERSION });
    }
    case "cookie_consent": {
      await db
        .from("profiles")
        .update({ cookie_consent: { v: 1, necessary: true, ...body.consent, ts: Date.now() } as never })
        .eq("id", userId);
      return ok({ saved: true });
    }
    case "sign_out_everywhere": {
      await db.auth.admin.signOut(userId, "global");
      return ok({ next: "/login" });
    }
    case "request_export": {
      await dispatchDataExport(userId);
      await audit(userId, "account.export.request", { type: "user", id: userId });
      return ok({ message: "We are preparing your export. You will receive an e-mail with a download link." });
    }
    case "delete_account": {
      // SPEC §21.5 — no grace period: the user confirms by typing the e-mail they are signed in
      // with, and the account is destroyed in this request.
      if (body.email.trim().toLowerCase() !== email.toLowerCase()) {
        throw new ApiError("email_mismatch", "That is not the e-mail address you are signed in with", 400);
      }
      const { data: teams } = await db.from("workspaces").select("id").eq("owner_id", userId).eq("type", "team");
      if (teams?.length) throw new ApiError("owns_team", "Transfer or delete your team workspaces first", 400);

      await audit(userId, "account.deletion.execute", { type: "user", id: userId });

      // Files first: if R2 fails the account stays intact and the user can retry.
      const { data: owned } = await db.from("workspaces").select("id").eq("owner_id", userId);
      try {
        await deleteUserFiles(userId, (owned ?? []).map((w) => w.id));
      } catch {
        throw new ApiError("delete_failed", "Could not delete your files. Nothing was removed — please try again.", 500);
      }
      const { error } = await db.auth.admin.deleteUser(userId);
      if (error) throw new ApiError("delete_failed", error.message, 500);
      // Confirmation only after everything is gone; failures must not fail the request.
      await sendTemplateEmail({ to: email, alias: "account-deleted", variables: {} }).catch(() => undefined);
      return ok({ deleted: true, next: "/" });
    }
    default:
      throw new ApiError("unknown_action", "Unknown action", 400);
  }
});
