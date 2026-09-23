import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

/** SPEC §5.2 — Google OAuth callback: exchange `code` for a session, then continue to `next`. */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/app";
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/app";
  if (code) {
    const supabase = await supabaseServer();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(safeNext, url.origin));
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(error.message)}`, url.origin));
  }
  const err = url.searchParams.get("error_description") ?? url.searchParams.get("error") ?? "Sign-in failed";
  return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(err)}`, url.origin));
}
