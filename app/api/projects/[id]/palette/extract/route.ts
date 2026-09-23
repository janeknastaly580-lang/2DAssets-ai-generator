import type { NextRequest } from "next/server";
import { z } from "zod";
import { handler, ok, parseJson, requireSameOrigin, requireUser, ApiError } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireWorkspaceRole } from "@/lib/workspace";
import { storage } from "@/lib/storage";
import { extractPalette } from "@/lib/postprocess/image";

/** SPEC §16.2 — extract a palette from a `palette` reference (or any reference) and optionally save it. */
export const POST = handler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  requireSameOrigin(req);
  const { id } = await params;
  const { userId } = await requireUser();
  const body = await parseJson(req, z.object({ reference_id: z.string().uuid(), colors: z.number().int().min(2).max(64).default(16), save: z.boolean().default(false) }));
  const db = supabaseAdmin();
  const { data: project } = await db.from("projects").select("workspace_id, style_guide").eq("id", id).maybeSingle();
  if (!project) throw new ApiError("not_found", "Project not found", 404);
  await requireWorkspaceRole(project.workspace_id, userId, "member");
  const { data: ref } = await db.from("project_references").select("r2_key").eq("id", body.reference_id).eq("project_id", id).maybeSingle();
  if (!ref) throw new ApiError("not_found", "Reference not found", 404);
  const palette = await extractPalette(await storage().get(ref.r2_key), body.colors);
  await db.from("project_references").update({ extracted_palette: palette as never }).eq("id", body.reference_id);
  if (body.save) {
    const sg = { ...((project.style_guide as Record<string, unknown>) ?? {}), palette };
    await db.from("projects").update({ style_guide: sg as never }).eq("id", id);
  }
  return ok({ palette });
});
