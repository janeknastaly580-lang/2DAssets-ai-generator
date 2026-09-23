"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/overlays";
import { post } from "@/lib/client/api";

/** SPEC §5.2 / §21.2 — blocking Terms acceptance (first Google sign-in or new ToS version). */
export function TosModal({ version }: { version: string }) {
  const router = useRouter();
  const [checked, setChecked] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const accept = async () => {
    setBusy(true);
    try {
      await post("/api/account", { action: "accept_tos" });
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
      setBusy(false);
    }
  };
  return (
    <Dialog open>
      <DialogContent size="sm" className="[&>button]:hidden" onEscapeKeyDown={(e) => e.preventDefault()} onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Terms of Service</DialogTitle>
          <DialogDescription>Please accept the current Terms of Service and Privacy Policy (version {version}) to continue.</DialogDescription>
        </DialogHeader>
        <label className="flex items-start gap-2 text-sm">
          <Checkbox checked={checked} onCheckedChange={(v) => setChecked(v === true)} className="mt-0.5" />
          <span>
            I accept the{" "}
            <Link href="/terms" target="_blank" className="underline">
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link href="/privacy" target="_blank" className="underline">
              Privacy Policy
            </Link>
          </span>
        </label>
        <DialogFooter>
          <Button onClick={accept} disabled={!checked || busy}>
            Continue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
