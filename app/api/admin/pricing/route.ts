import type { NextRequest } from "next/server";
import { handler, ok, parseJson, requireSameOrigin, requireAdmin, audit, getClientIp } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { adminPricingSchema } from "@/lib/validation/misc";
import { loadPricing } from "@/lib/credits/pricing";

export const GET = handler(async () => {
  await requireAdmin();
  const { data } = await supabaseAdmin().from("model_pricing").select("*").order("id");
  return ok(data ?? []);
});

/** PUT /api/admin/pricing — edit model_pricing (immediate, audited) — SPEC §19 Pricing. */
export const PUT = handler(async (req: NextRequest) => {
  requireSameOrigin(req);
  const admin = await requireAdmin();
  const body = await parseJson(req, adminPricingSchema);
  const { id, ...patch } = body;
  const { data, error } = await supabaseAdmin()
    .from("model_pricing")
    .update({ ...patch, params: patch.params as never, updated_by: admin.userId })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  await loadPricing(true);
  await audit(admin.userId, "admin.pricing.update", { type: "model_pricing", id }, patch as Record<string, unknown>, getClientIp(req));
  return ok(data);
});
