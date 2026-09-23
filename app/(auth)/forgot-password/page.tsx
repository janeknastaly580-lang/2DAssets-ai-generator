"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/primitives";
import { post } from "@/lib/client/api";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await post<{ next: string; message: string }>("/api/auth/forgot-password", { email: email.trim().toLowerCase() });
      toast.success(res.message);
      router.push(res.next);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell
      title="Forgot your password?"
      description="Enter your e-mail and we will send an 8-digit code."
      footer={
        <Link href="/login" className="text-foreground underline">
          Back to sign in
        </Link>
      }
    >
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div className="grid gap-2">
          <Label htmlFor="email">E-mail</Label>
          <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <Button type="submit" disabled={busy}>
          {busy ? "Sending…" : "Send code"}
        </Button>
      </form>
    </AuthShell>
  );
}
