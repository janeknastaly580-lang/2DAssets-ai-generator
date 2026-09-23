import type { NextRequest } from "next/server";
import { handler, ok, parseJson, requireSameOrigin, requireUser, ApiError } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createProjectSchema } from "@/lib/validation/project";
import { getCurrentWorkspace, isWorkspaceReadOnly, roleAtLeast } from "@/lib/workspace";
import { slugify } from "@/lib/utils";

/** GET — projects of the current workspace with asset counts (SPEC §16.2). */
export const GET = handler(async (req: NextRequest) => {
  const { userId } = await requireUser();
  const { workspace } = await getCurrentWorkspace(userId);
  const includeArchived = req.nextUrl.searchParams.get("archived") === "1";
  const db = supabaseAdmin();
  let q = db.from("projects").select("*, assets!assets_project_id_fkey(count)").eq("workspace_id", workspace.id).order("is_scratch", { ascending: false }).order("updated_at", { ascending: false });
  if (!includeArchived) q = q.is("archived_at", null);
  const { data, error } = await q;
  if (error) throw error;
  const covers = new Map<string, string | null>();
  const coverIds = (data ?? []).map((p) => p.cover_asset_id).filter(Boolean) as string[];
  if (coverIds.length) {
    const { data: assets } = await db.from("assets").select("id, preview_key").in("id", coverIds);
    for (const a of assets ?? []) covers.set(a.id, a.preview_key);
  }
  return ok(
    (data ?? []).map((p) => ({
      ...p,
      asset_count: (p.assets as unknown as { count: number }[])?.[0]?.count ?? 0,
      cover_preview_key: p.cover_asset_id ? covers.get(p.cover_asset_id) ?? null : null,
      assets: undefined,
    })),
  );
});

export const POST = handler(async (req: NextRequest) => {
  requireSameOrigin(req);
  const { userId } = await requireUser();
  const { workspace, role } = await getCurrentWorkspace(userId);
  if (!roleAtLeast(role, "member")) throw new ApiError("forbidden", "Viewers cannot create projects", 403);
  if (isWorkspaceReadOnly(workspace)) throw new ApiError("read_only", "This team workspace needs an active Studio subscription", 403);
  const body = await parseJson(req, createProjectSchema);
  const base = slugify(body.name);
  const db = supabaseAdmin();
  let slug = base;
  for (let i = 2; i < 50; i++) {
    const { count } = await db.from("projects").select("id", { count: "exact", head: true }).eq("workspace_id", workspace.id).eq("slug", slug);
    if (!count) break;
    slug = `${base}-${i}`;
  }
  const { data, error } = await db
    .from("projects")
    .insert({ workspace_id: workspace.id, name: body.name, slug, description: body.description ?? null, style_guide: body.style_guide as never, created_by: userId })
    .select("*")
    .single();
  if (error) throw error;
  return ok(data, { status: 201 });
});
