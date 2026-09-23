import type { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { handler, ok, requireSameOrigin, requireUser, audit, ApiError } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { hashInviteToken } from "@/lib/share";
import { WS_COOKIE } from "@/lib/workspace";

/** SPEC §6.2 — accept an invite; the account e-mail must match the invited e-mail. */
export const POST = handler(async (req: NextRequest, { params }: { params: Promise<{ token: string }> }) => {
  requireSameOrigin(req);
  const { token } = await params;
  const { userId, email } = await requireUser();
  const db = supabaseAdmin();
  const { data: inv } = await db.from("workspace_invites").select("*").eq("token_hash", hashInviteToken(token)).maybeSingle();
  if (!inv || inv.accepted_at || new Date(inv.expires_at).getTime() < Date.now()) {
    throw new ApiError("invite_invalid", "This invitation is no longer valid", 404);
  }
  if (inv.email.toLowerCase() !== email.toLowerCase()) {
    throw new ApiError("email_mismatch", `This invitation was sent to ${inv.email}. Sign in with that account.`, 403);
  }
  const { count } = await db.from("workspace_members").select("user_id", { count: "exact", head: true }).eq("workspace_id", inv.workspace_id);
  const { data: ws } = await db.from("workspaces").select("seats, name").eq("id", inv.workspace_id).single();
  if (ws && (count ?? 0) >= ws.seats) throw new ApiError("seats_exhausted", "This workspace has no free seats", 400);
  await db.from("workspace_members").upsert({ workspace_id: inv.workspace_id, user_id: userId, role: inv.role, invited_by: inv.invited_by });
  await db.from("workspace_invites").update({ accepted_at: new Date().toISOString() }).eq("id", inv.id);
  await audit(userId, "workspace.invite.accept", { type: "workspace", id: inv.workspace_id });
  const store = await cookies();
  store.set(WS_COOKIE, inv.workspace_id, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365 });
  return ok({ workspace_id: inv.workspace_id, name: ws?.name });
});
