import "server-only";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ApiError } from "@/lib/api";
import type { Database } from "@/lib/supabase/database.types";

export type Workspace = Database["public"]["Tables"]["workspaces"]["Row"];
export type MemberRole = Database["public"]["Enums"]["member_role"];

export const WS_COOKIE = "vf_ws";

const ROLE_RANK: Record<MemberRole, number> = { owner: 4, admin: 3, member: 2, viewer: 1 };

export function roleAtLeast(role: MemberRole, min: MemberRole) {
  return ROLE_RANK[role] >= ROLE_RANK[min];
}

export interface WorkspaceContext {
  workspace: Workspace;
  role: MemberRole;
}

/** Membership lookup via service role (no RLS round-trips). */
export async function getMembership(workspaceId: string, userId: string): Promise<WorkspaceContext | null> {
  const db = supabaseAdmin();
  const { data: m } = await db
    .from("workspace_members")
    .select("role, workspaces(*)")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!m || !m.workspaces) return null;
  return { workspace: m.workspaces as Workspace, role: m.role };
}

/** Resolves the current workspace from the `vf_ws` cookie, falling back to the personal one (SPEC §6). */
export async function getCurrentWorkspace(userId: string): Promise<WorkspaceContext> {
  const store = await cookies();
  const wanted = store.get(WS_COOKIE)?.value;
  if (wanted) {
    const ctx = await getMembership(wanted, userId);
    if (ctx) return ctx;
  }
  const db = supabaseAdmin();
  const { data: personal } = await db
    .from("workspaces")
    .select("*")
    .eq("owner_id", userId)
    .eq("type", "personal")
    .maybeSingle();
  if (personal) return { workspace: personal, role: "owner" };
  const { data: any } = await db
    .from("workspace_members")
    .select("role, workspaces(*)")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  if (any?.workspaces) return { workspace: any.workspaces as Workspace, role: any.role };
  throw new ApiError("no_workspace", "No workspace found for this account", 500);
}

export async function requireWorkspaceRole(
  workspaceId: string,
  userId: string,
  min: MemberRole = "viewer",
): Promise<WorkspaceContext> {
  const ctx = await getMembership(workspaceId, userId);
  if (!ctx) throw new ApiError("forbidden", "You are not a member of this workspace", 403);
  if (!roleAtLeast(ctx.role, min)) throw new ApiError("forbidden", `Requires ${min} role`, 403);
  return ctx;
}

/** Team workspaces without an active Studio subscription are read-only (SPEC §6). */
export function isWorkspaceReadOnly(ws: Workspace): boolean {
  if (ws.type !== "team") return false;
  return !(ws.plan === "studio" && (ws.subscription_status === "active" || ws.subscription_status === "past_due"));
}
