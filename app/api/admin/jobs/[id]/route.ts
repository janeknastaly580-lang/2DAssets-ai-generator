import type { NextRequest } from "next/server";
import { handler, ok, requireAdmin, ApiError } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabase/admin";

/** GET /api/admin/jobs/:id — full details including translated_prompt (SPEC §19). */
export const GET = handler(async (_req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  await requireAdmin();
  const { id } = await params;
  const db = supabaseAdmin();
  const { data: job } = await db.from("jobs").select("*").eq("id", id).maybeSingle();
  if (!job) throw new ApiError("not_found", "Job not found", 404);
  const [{ data: user }, { data: events }, { data: assets }] = await Promise.all([
    db.from("profiles").select("id, email, display_name").eq("id", job.user_id).maybeSingle(),
    db.from("moderation_events").select("*").eq("job_id", id),
    db.from("assets").select("id, name, type, status").in("id", job.result_asset_ids.length ? job.result_asset_ids : ["00000000-0000-0000-0000-000000000000"]),
  ]);
  return ok({ ...job, user, moderation_events: events ?? [], assets: assets ?? [] });
});
