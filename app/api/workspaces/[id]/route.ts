import type { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { handler, ok, parseJson, requireSameOrigin, requireUser, audit, ApiError } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { updateWorkspaceSchema } from "@/lib/validation/misc";
import { requireWorkspaceRole, WS_COOKIE } from "@/lib/workspace";
import { storage } from "@/lib/storage";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handler(async (_req: NextRequest, { params }: Ctx) => {
  const { id } = await params;
  const { userId } = await requireUser();
  const ctx = await requireWorkspaceRole(id, userId, "viewer");
  const { data: members } = await supabaseAdmin()
    .from("workspace_members")
    .select("user_id, role, joined_at, profiles!workspace_members_user_id_fkey(display_name, email, avatar_key)")
    .eq("workspace_id", id);
  return ok({ ...ctx.workspace, role: ctx.role, members: members ?? [] });
});

export const PATCH = handler(async (req: NextRequest, { params }: Ctx) => {
  requireSameOrigin(req);
  const { id } = await params;
  const { userId } = await requireUser();
  await requireWorkspaceRole(id, userId, "owner");
  const body = await parseJson(req, updateWorkspaceSchema);
  const { data, error } = await supabaseAdmin().from("workspaces").update({ name: body.name }).eq("id", id).select("*").single();
  if (error) throw error;
  await audit(userId, "workspace.update", { type: "workspace", id }, body);
  return ok(data);
});

/** Delete a team workspace (owner only). Personal workspaces cannot be deleted (SPEC §6). */
export const DELETE = handler(async (req: NextRequest, { params }: Ctx) => {
  requireSameOrigin(req);
  const { id } = await params;
  const { userId } = await requireUser();
  const ctx = await requireWorkspaceRole(id, userId, "owner");
  if (ctx.workspace.type === "personal") throw new ApiError("forbidden", "Personal workspaces cannot be deleted", 400);
  if (ctx.workspace.subscription_status === "active") {
    throw new ApiError("subscription_active", "Cancel the Studio subscription first (Manage subscription)", 400);
  }
  await storage().deletePrefix(`ws/${id}/`).catch(() => undefined);
  const { error } = await supabaseAdmin().from("workspaces").delete().eq("id", id);
  if (error) throw error;
  await audit(userId, "workspace.delete", { type: "workspace", id });
  const store = await cookies();
  if (store.get(WS_COOKIE)?.value === id) store.delete(WS_COOKIE);
  return ok({ deleted: true });
});
