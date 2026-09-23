import type { NextRequest } from "next/server";
import { handler, ok, parseJson, requireSameOrigin, requireAdmin, audit, getClientIp, ApiError } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { adminCreditsSchema } from "@/lib/validation/misc";
import { grantCredits } from "@/lib/credits/ledger";

/** POST /api/admin/users/:id/credits — add/subtract usage credits with a reason (SPEC §19). */
export const POST = handler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  requireSameOrigin(req);
  const admin = await requireAdmin();
  const { id } = await params;
  const body = await parseJson(req, adminCreditsSchema);
  const db = supabaseAdmin();
  const { data: ws } = await db.from("workspaces").select("id").eq("id", body.workspace_id).maybeSingle();
  if (!ws) throw new ApiError("not_found", "Workspace not found", 404);
  await grantCredits({
    workspaceId: ws.id,
    bucket: "purchased",
    amount: body.amount,
    kind: "admin_adjustment",
    actorId: admin.userId,
    description: body.reason,
  });
  await audit(admin.userId, "admin.credits.adjust", { type: "workspace", id: ws.id }, { user_id: id, amount: body.amount, reason: body.reason }, getClientIp(req));
  const { data: balance } = await db.from("credit_balances").select("*").eq("workspace_id", ws.id).single();
  return ok(balance);
});
