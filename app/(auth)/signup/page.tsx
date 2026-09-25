"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/primitives";
import { Checkbox } from "@/components/ui/overlays";
import { post } from "@/lib/client/api";
import { signupSchema } from "@/lib/validation/auth";
import { PENDING_SIGNUP_KEY } from "@/lib/client/constants";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [tos, setTos] = React.useState(false);
  const [marketing, setMarketing] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = signupSchema.safeParse({ email, password, accept_tos: tos, marketing_consent: marketing });
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const issue of parsed.error.issues) errs[String(issue.path[0])] = issue.message;
      setErrors(errs);
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      const res = await post<{ next?: string }>("/api/auth/signup", parsed.data);
      sessionStorage.setItem(PENDING_SIGNUP_KEY, JSON.stringify({ email: parsed.data.email, password }));
      router.push(res.next ?? `/verify?email=${encodeURIComponent(parsed.data.email)}`);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell
      title="Create your account"
      description="Start generating game-ready assets"
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="text-foreground underline">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div className="grid gap-2">
          <Label htmlFor="email">E-mail</Label>
          <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={Boolean(errors.email)} />
          {errors.email && <p className="text-destructive text-xs">{errors.email}</p>}
        </div>
        <div className="grid gap-2">
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" maxLength={30} autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} aria-invalid={Boolean(errors.password)} />
          <p className="text-muted-foreground text-xs">10–30 characters with a letter and a digit.</p>
          {errors.password && <p className="text-destructive text-xs">{errors.password}</p>}
        </div>
        <label className="flex items-start gap-2 text-sm">
          <Checkbox checked={tos} onCheckedChange={(v) => setTos(v === true)} className="mt-0.5" />
          <span>
            I accept the{" "}
            <Link href="/terms" className="underline" target="_blank">
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="underline" target="_blank">
              Privacy Policy
            </Link>
          </span>
        </label>
        {errors.accept_tos && <p className="text-destructive -mt-2 text-xs">{errors.accept_tos}</p>}
        <label className="flex items-start gap-2 text-sm">
          <Checkbox checked={marketing} onCheckedChange={(v) => setMarketing(v === true)} className="mt-0.5" />
          <span className="text-muted-foreground">Send me product updates (optional)</span>
        </label>
        <Button type="submit" disabled={busy}>
          {busy ? "Creating account…" : "Create account"}
        </Button>
      </form>
    </AuthShell>
  );
}
