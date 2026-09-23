import type { NextRequest } from "next/server";
import { handler, ok, parseJson, requireSameOrigin, requireUser, audit, ApiError } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createWorkspaceSchema } from "@/lib/validation/misc";
import { slugify } from "@/lib/utils";
import { PLANS } from "@/lib/plans";

/** GET — workspaces of the current user (with role). */
export const GET = handler(async () => {
  const { userId } = await requireUser();
  const { data, error } = await supabaseAdmin()
    .from("workspace_members")
    .select("role, workspaces(*)")
    .eq("user_id", userId);
  if (error) throw error;
  return ok((data ?? []).map((m) => ({ role: m.role, ...(m.workspaces as object) })));
});

/**
 * POST — create a team workspace (SPEC §6). Requires that the user owns a workspace with an
 * active Studio plan (or the new workspace is immediately taken to Studio checkout).
 */
export const POST = handler(async (req: NextRequest) => {
  requireSameOrigin(req);
  const { userId } = await requireUser();
  const body = await parseJson(req, createWorkspaceSchema);
  const db = supabaseAdmin();
  const { data: owned } = await db.from("workspaces").select("id, plan, subscription_status").eq("owner_id", userId);
  const hasStudio = (owned ?? []).some((w) => w.plan === "studio" && w.subscription_status === "active");
  const slug = `t-${slugify(body.name, 24)}-${Math.random().toString(36).slice(2, 6)}`;
  const { data: ws, error } = await db
    .from("workspaces")
    .insert({ name: body.name, slug, type: "team", owner_id: userId, seats: PLANS.studio.seats })
    .select("*")
    .single();
  if (error || !ws) throw new ApiError("create_failed", error?.message ?? "Could not create workspace", 400);
  await db.from("workspace_members").insert({ workspace_id: ws.id, user_id: userId, role: "owner" });
  await db.from("credit_balances").insert({ workspace_id: ws.id });
  await db.from("projects").insert({ workspace_id: ws.id, name: "Scratch", slug: "scratch", is_scratch: true, created_by: userId, description: "Quick experiments without a style guide." });
  await audit(userId, "workspace.create", { type: "workspace", id: ws.id }, { name: body.name, hasStudio });
  // Team workspaces are read-only until a Studio subscription is active (§6)
  return ok({ workspace: ws, needs_checkout: true, has_studio_elsewhere: hasStudio });
});
