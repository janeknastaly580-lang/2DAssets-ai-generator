import type { NextRequest } from "next/server";
import { handler, ok, parseJson, requireSameOrigin, requireAdmin, audit, getClientIp } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { adminFlagSchema } from "@/lib/validation/misc";
import { loadFlags } from "@/lib/flags";

export const GET = handler(async () => {
  await requireAdmin();
  const { data } = await supabaseAdmin().from("feature_flags").select("*").order("key");
  return ok(data ?? []);
});

/** PUT /api/admin/flags — upsert a feature flag (SPEC §19 Flags). */
export const PUT = handler(async (req: NextRequest) => {
  requireSameOrigin(req);
  const admin = await requireAdmin();
  const body = await parseJson(req, adminFlagSchema);
  const db = supabaseAdmin();
  const { data: existing } = await db.from("feature_flags").select("*").eq("key", body.key).maybeSingle();
  const { data, error } = await db
    .from("feature_flags")
    .upsert({ key: body.key, enabled: body.enabled ?? existing?.enabled ?? false, payload: (body.payload ?? existing?.payload ?? {}) as never })
    .select("*")
    .single();
  if (error) throw error;
  await loadFlags(true);
  await audit(admin.userId, "admin.flag.update", { type: "feature_flag", id: body.key }, body as Record<string, unknown>, getClientIp(req));
  return ok(data);
});
