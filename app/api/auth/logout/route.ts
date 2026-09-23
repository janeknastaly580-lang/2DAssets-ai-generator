import type { NextRequest } from "next/server";
import { handler, ok, requireSameOrigin } from "@/lib/api";
import { supabaseServer } from "@/lib/supabase/server";

export const POST = handler(async (req: NextRequest) => {
  requireSameOrigin(req);
  const supabase = await supabaseServer();
  await supabase.auth.signOut();
  return ok({ next: "/login" });
});
