import type { NextRequest } from "next/server";
import { handler, ok, parseJson, requireSameOrigin, requireAdmin, audit, getClientIp, ApiError } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { adminWorkspacePatchSchema } from "@/lib/validation/misc";
import { PLANS } from "@/lib/plans";
import { resetSubscriptionCredits } from "@/lib/credits/ledger";

/** PATCH /api/admin/workspaces/:id — manual plan change (e.g. complimentary Studio), audited (SPEC §19). */
export const PATCH = handler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  requireSameOrigin(req);
  const admin = await requireAdmin();
  const { id } = await params;
  const body = await parseJson(req, adminWorkspacePatchSchema);
  const db = supabaseAdmin();
  const { data: ws } = await db.from("workspaces").select("*").eq("id", id).maybeSingle();
  if (!ws) throw new ApiError("not_found", "Workspace not found", 404);
  if (body.plan) {
    const cfg = PLANS[body.plan];
    await db
      .from("workspaces")
      .update({
        plan: body.plan,
        subscription_status: body.plan === "pro" || body.plan === "studio" ? "active" : ws.subscription_status,
        storage_quota_bytes: cfg.storageBytes,
        retention_days: cfg.retentionDays,
        seats: cfg.seats,
        current_period_end: body.plan === "pro" || body.plan === "studio" ? new Date(Date.now() + 30 * 86_400_000).toISOString() : ws.current_period_end,
      })
      .eq("id", id);
    if (body.plan === "pro" || body.plan === "studio") {
      await resetSubscriptionCredits(id, cfg.credits, new Date(Date.now() + 33 * 86_400_000), `admin:${admin.userId}:${Date.now()}`);
      await db.from("assets").update({ expires_at: null }).eq("workspace_id", id).is("deleted_at", null);
    }
  }
  await audit(admin.userId, "admin.workspace.plan", { type: "workspace", id }, { plan: body.plan, reason: body.reason }, getClientIp(req));
  const { data } = await db.from("workspaces").select("*").eq("id", id).single();
  return ok(data);
});
