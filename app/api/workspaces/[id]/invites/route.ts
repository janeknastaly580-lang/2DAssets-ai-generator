import type { NextRequest } from "next/server";
import { handler, ok, parseJson, requireSameOrigin, requireUser, audit, ApiError } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { inviteSchema } from "@/lib/validation/misc";
import { requireWorkspaceRole } from "@/lib/workspace";
import { newInviteToken } from "@/lib/share";
import { sendTemplateEmail } from "@/lib/email/resend";
import { env } from "@/lib/env";

/** POST — invite by e-mail (SPEC §6.2): hashed 32-byte token, 7-day TTL, Resend `workspace-invite`. */
export const POST = handler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  requireSameOrigin(req);
  const { id } = await params;
  const { userId, profile } = await requireUser();
  const ctx = await requireWorkspaceRole(id, userId, "admin");
  if (ctx.workspace.type !== "team") throw new ApiError("forbidden", "Only team workspaces can have members", 400);
  const body = await parseJson(req, inviteSchema);
  const db = supabaseAdmin();
  const { count } = await db.from("workspace_members").select("user_id", { count: "exact", head: true }).eq("workspace_id", id);
  if ((count ?? 0) >= ctx.workspace.seats) throw new ApiError("seats_exhausted", `This workspace has ${ctx.workspace.seats} seats`, 400);
  const { token, hash } = newInviteToken();
  const { data: invite, error } = await db
    .from("workspace_invites")
    .insert({
      workspace_id: id,
      email: body.email,
      role: body.role,
      token_hash: hash,
      invited_by: userId,
      expires_at: new Date(Date.now() + 7 * 86_400_000).toISOString(),
    })
    .select("id, email, role, expires_at")
    .single();
  if (error) throw error;
  const inviteUrl = `${env.APP_URL}/invite/${token}`;
  await sendTemplateEmail({
    to: body.email,
    alias: "workspace-invite",
    variables: { INVITER_NAME: profile.display_name ?? profile.email, WORKSPACE_NAME: ctx.workspace.name, INVITE_URL: inviteUrl },
  });
  await audit(userId, "workspace.invite.create", { type: "workspace", id }, { email: body.email, role: body.role });
  return ok({ invite, invite_url: inviteUrl });
});
