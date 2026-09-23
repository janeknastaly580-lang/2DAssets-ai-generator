"use client";

import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabaseBrowser } from "@/lib/supabase/browser";

/** SPEC §5.2 — "Continue with Google" via Supabase OAuth. */
export function GoogleButton({ next = "/app" }: { next?: string }) {
  const [busy, setBusy] = React.useState(false);
  const click = async () => {
    setBusy(true);
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
    const { error } = await supabaseBrowser().auth.signInWithOAuth({ provider: "google", options: { redirectTo } });
    if (error) {
      toast.error(error.message.includes("provider") ? "Google sign-in is not enabled yet (configure it in Supabase → Auth → Providers)." : error.message);
      setBusy(false);
    }
  };
  return (
    <Button type="button" variant="outline" className="w-full" onClick={click} disabled={busy}>
      <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
        <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.3-1.6 3.8-5.5 3.8-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.2.8 3.9 1.5l2.7-2.6C16.9 3 14.7 2 12 2 6.5 2 2 6.5 2 12s4.5 10 10 10c5.8 0 9.6-4.1 9.6-9.8 0-.7-.1-1.2-.2-1.7H12z" />
      </svg>
      Continue with Google
    </Button>
  );
}
