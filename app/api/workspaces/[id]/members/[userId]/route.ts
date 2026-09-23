import type { NextRequest } from "next/server";
import { handler, ok, parseJson, requireSameOrigin, requireUser, audit, ApiError } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { memberRoleSchema } from "@/lib/validation/misc";
import { requireWorkspaceRole } from "@/lib/workspace";

type Ctx = { params: Promise<{ id: string; userId: string }> };

/** PATCH role (owner/admin; admins cannot touch the owner) — SPEC §6.1. */
export const PATCH = handler(async (req: NextRequest, { params }: Ctx) => {
  requireSameOrigin(req);
  const { id, userId: target } = await params;
  const { userId } = await requireUser();
  const ctx = await requireWorkspaceRole(id, userId, "admin");
  if (target === ctx.workspace.owner_id) throw new ApiError("forbidden", "The owner's role cannot be changed", 403);
  const body = await parseJson(req, memberRoleSchema);
  const { error } = await supabaseAdmin().from("workspace_members").update({ role: body.role }).eq("workspace_id", id).eq("user_id", target);
  if (error) throw error;
  await audit(userId, "workspace.member.role", { type: "workspace", id }, { target, role: body.role });
  return ok({ user_id: target, role: body.role });
});

/** DELETE — remove a member, or leave (self) unless owner. */
export const DELETE = handler(async (req: NextRequest, { params }: Ctx) => {
  requireSameOrigin(req);
  const { id, userId: target } = await params;
  const { userId } = await requireUser();
  const ctx = await requireWorkspaceRole(id, userId, "viewer");
  if (target === ctx.workspace.owner_id) throw new ApiError("forbidden", "The owner cannot be removed", 403);
  if (target !== userId && !["owner", "admin"].includes(ctx.role)) throw new ApiError("forbidden", "Requires admin role", 403);
  if (ctx.workspace.type === "personal") throw new ApiError("forbidden", "Personal workspaces have a single member", 400);
  const { error } = await supabaseAdmin().from("workspace_members").delete().eq("workspace_id", id).eq("user_id", target);
  if (error) throw error;
  await audit(userId, target === userId ? "workspace.member.leave" : "workspace.member.remove", { type: "workspace", id }, { target });
  return ok({ removed: target });
});
