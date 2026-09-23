import type { NextRequest } from "next/server";
import { handler, ok, requireSameOrigin, requireUser } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { loadAsset } from "@/lib/assets";

/** POST /api/assets/:id/restore — restore from Trash (SPEC §13). */
export const POST = handler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  requireSameOrigin(req);
  const { id } = await params;
  const { userId } = await requireUser();
  await loadAsset(id, userId, "member");
  await supabaseAdmin().from("assets").update({ deleted_at: null }).eq("id", id);
  return ok({ restored: id });
});
