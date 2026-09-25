"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { Input, Label, Alert, AlertDescription } from "@/components/ui/primitives";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { post } from "@/lib/client/api";
import { track } from "@/lib/analytics";

function LoginForm() {
  const router = useRouter();
  const sp = useSearchParams();
  const next = sp.get("next") ?? "/app";
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [unverified, setUnverified] = React.useState(false);
  const info = sp.get("verified") ? "E-mail verified — sign in to continue." : sp.get("reset") ? "Password changed. Sign in with your new password." : sp.get("error");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setUnverified(false);
    const { error } = await supabaseBrowser().auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
    setBusy(false);
    if (error) {
      if (/confirm|verified/i.test(error.message)) setUnverified(true);
      else toast.error("Invalid e-mail or password");
      return;
    }
    track("login", { method: "email" });
    router.replace(next.startsWith("/") ? next : "/app");
    router.refresh();
  };

  const resend = async () => {
    try {
      await post("/api/auth/resend-code", { email: email.trim().toLowerCase(), purpose: "signup" });
      router.push(`/verify?email=${encodeURIComponent(email.trim().toLowerCase())}`);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <AuthShell
      title="Welcome back"
      description="Sign in to your Veyraflow account"
      footer={
        <>
          No account?{" "}
          <Link href="/signup" className="text-foreground underline">
            Sign up
          </Link>
        </>
      }
    >
      {info && (
        <Alert variant={sp.get("error") ? "destructive" : "info"} className="mb-4">
          <AlertDescription>{info}</AlertDescription>
        </Alert>
      )}
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div className="grid gap-2">
          <Label htmlFor="email">E-mail</Label>
          <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="grid gap-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link href="/forgot-password" className="text-muted-foreground text-xs underline">
              Forgot password?
            </Link>
          </div>
          <Input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        {unverified && (
          <Alert variant="warning">
            <AlertDescription className="flex items-center justify-between gap-2">
              <span>Your e-mail is not verified yet.</span>
              <Button type="button" size="sm" variant="outline" onClick={resend}>
                Verify email
              </Button>
            </AlertDescription>
          </Alert>
        )}
        <Button type="submit" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </AuthShell>
  );
}

export default function LoginPage() {
  return (
    <React.Suspense>
      <LoginForm />
    </React.Suspense>
  );
}
