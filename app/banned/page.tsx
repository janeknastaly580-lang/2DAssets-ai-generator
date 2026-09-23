import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { supabaseServer } from "@/lib/supabase/server";
import { env } from "@/lib/env";

export const metadata = { title: "Account suspended" };

/** SPEC §5.4 — banned users land here; the session is signed out. */
export default async function BannedPage() {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  let reason: string | null = null;
  if (user) {
    const { data } = await supabase.from("profiles").select("ban_reason").eq("id", user.id).maybeSingle();
    reason = data?.ban_reason ?? null;
    await supabase.auth.signOut();
  }
  return (
    <AuthShell title="Your account has been suspended" description="You can no longer sign in or generate assets.">
      <div className="flex flex-col gap-4 text-sm">
        <p>
          Reason: <span className="font-medium">{reason ?? "Violation of the Terms of Service"}</span>
        </p>
        <p className="text-muted-foreground">
          If you believe this is a mistake, contact{" "}
          <a href={`mailto:${env.SUPPORT_EMAIL}`} className="underline">
            {env.SUPPORT_EMAIL}
          </a>
          .
        </p>
        <Link href="/" className="text-primary underline">
          Back to the homepage
        </Link>
      </div>
    </AuthShell>
  );
}
