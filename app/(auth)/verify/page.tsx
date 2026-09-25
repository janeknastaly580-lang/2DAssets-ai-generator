"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { AuthShell } from "@/components/auth/auth-shell";
import { OtpInput } from "@/components/auth/otp-input";
import { Button } from "@/components/ui/button";
import { post } from "@/lib/client/api";
import { PENDING_SIGNUP_KEY } from "@/lib/client/constants";
import { track } from "@/lib/analytics";

function VerifyForm() {
  const router = useRouter();
  const sp = useSearchParams();
  const email = sp.get("email") ?? "";
  const [code, setCode] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [cooldown, setCooldown] = React.useState(60);

  React.useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const submit = React.useCallback(async () => {
    if (code.length !== 6 || busy) return;
    setBusy(true);
    try {
      let password: string | undefined;
      try {
        const pending = JSON.parse(sessionStorage.getItem(PENDING_SIGNUP_KEY) ?? "null") as { email: string; password: string } | null;
        if (pending?.email === email) password = pending.password;
      } catch {
        /* ignore */
      }
      const res = await post<{ next: string }>("/api/auth/verify-signup", { email, code, password });
      sessionStorage.removeItem(PENDING_SIGNUP_KEY);
      track("sign_up", { method: "email" });
      toast.success("E-mail verified");
      router.replace(res.next);
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
      setCode("");
    } finally {
      setBusy(false);
    }
  }, [code, busy, email, router]);

  React.useEffect(() => {
    if (code.length === 6) void submit();
  }, [code, submit]);

  const resend = async () => {
    try {
      await post("/api/auth/resend-code", { email, purpose: "signup" });
      toast.success("If this e-mail is valid, a new code was sent.");
      setCooldown(60);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <AuthShell title="Check your inbox" description={`We sent a 6-digit code to ${email || "your e-mail"}. It expires in 10 minutes.`}>
      <div className="flex flex-col gap-6">
        <OtpInput length={6} value={code} onChange={setCode} disabled={busy} />
        <Button onClick={submit} disabled={busy || code.length !== 6}>
          {busy ? "Verifying…" : "Verify"}
        </Button>
        <div className="text-muted-foreground text-center text-sm">
          Didn&apos;t get it?{" "}
          <button type="button" className="text-foreground underline disabled:opacity-50" disabled={cooldown > 0} onClick={resend}>
            Resend code{cooldown > 0 ? ` (${cooldown}s)` : ""}
          </button>
        </div>
      </div>
    </AuthShell>
  );
}

export default function VerifyPage() {
  return (
    <React.Suspense>
      <VerifyForm />
    </React.Suspense>
  );
}
