import type { NextRequest } from "next/server";
import { handler, ok, requireUser } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireWorkspaceRole } from "@/lib/workspace";

type Ctx = { params: Promise<{ id: string }> };

/** GET — members + pending invites (SPEC §16.2). */
export const GET = handler(async (_req: NextRequest, { params }: Ctx) => {
  const { id } = await params;
  const { userId } = await requireUser();
  const ctx = await requireWorkspaceRole(id, userId, "viewer");
  const db = supabaseAdmin();
  const { data: members } = await db
    .from("workspace_members")
    .select("user_id, role, joined_at, profiles!workspace_members_user_id_fkey(display_name, email, avatar_key)")
    .eq("workspace_id", id)
    .order("joined_at");
  let invites: unknown[] = [];
  if (ctx.role === "owner" || ctx.role === "admin") {
    const { data } = await db
      .from("workspace_invites")
      .select("id, email, role, expires_at, accepted_at, created_at")
      .eq("workspace_id", id)
      .is("accepted_at", null)
      .gt("expires_at", new Date().toISOString());
    invites = data ?? [];
  }
  return ok({ members: members ?? [], invites, seats: ctx.workspace.seats });
});
