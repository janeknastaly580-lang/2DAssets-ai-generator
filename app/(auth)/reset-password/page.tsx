"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { AuthShell } from "@/components/auth/auth-shell";
import { OtpInput } from "@/components/auth/otp-input";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/primitives";
import { post } from "@/lib/client/api";
import { resetPasswordSchema } from "@/lib/validation/auth";

function ResetForm() {
  const router = useRouter();
  const sp = useSearchParams();
  const email = sp.get("email") ?? "";
  const [code, setCode] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [cooldown, setCooldown] = React.useState(60);

  React.useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = resetPasswordSchema.safeParse({ email, code, password, confirm });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Check the form");
      return;
    }
    setBusy(true);
    try {
      const res = await post<{ next: string }>("/api/auth/reset-password", parsed.data);
      toast.success("Password changed");
      router.replace(res.next);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    try {
      await post("/api/auth/resend-code", { email, purpose: "password_reset" });
      toast.success("If an account exists, a new code was sent.");
      setCooldown(60);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <AuthShell title="Reset your password" description={`Enter the 8-digit code sent to ${email || "your e-mail"} and choose a new password.`}>
      <form onSubmit={submit} className="flex flex-col gap-5">
        <OtpInput length={8} value={code} onChange={setCode} />
        <div className="grid gap-2">
          <Label htmlFor="password">New password</Label>
          <Input id="password" type="password" maxLength={30} autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="confirm">Repeat password</Label>
          <Input id="confirm" type="password" maxLength={30} autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </div>
        <Button type="submit" disabled={busy}>
          {busy ? "Saving…" : "Set new password"}
        </Button>
        <div className="text-muted-foreground text-center text-sm">
          <button type="button" className="text-foreground underline disabled:opacity-50" disabled={cooldown > 0} onClick={resend}>
            Resend code{cooldown > 0 ? ` (${cooldown}s)` : ""}
          </button>
        </div>
      </form>
    </AuthShell>
  );
}

export default function ResetPasswordPage() {
  return (
    <React.Suspense>
      <ResetForm />
    </React.Suspense>
  );
}
