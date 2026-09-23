import type { NextRequest } from "next/server";
import { handler, ok, requireSameOrigin, requireUser, audit } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireWorkspaceRole } from "@/lib/workspace";

export const DELETE = handler(async (req: NextRequest, { params }: { params: Promise<{ id: string; inviteId: string }> }) => {
  requireSameOrigin(req);
  const { id, inviteId } = await params;
  const { userId } = await requireUser();
  await requireWorkspaceRole(id, userId, "admin");
  const { error } = await supabaseAdmin().from("workspace_invites").delete().eq("id", inviteId).eq("workspace_id", id);
  if (error) throw error;
  await audit(userId, "workspace.invite.revoke", { type: "workspace", id }, { inviteId });
  return ok({ revoked: inviteId });
});
