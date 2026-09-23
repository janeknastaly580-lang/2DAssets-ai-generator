"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { post, ApiClientError } from "@/lib/client/api";

/** SPEC §6.2 — /invite/[token]: sign in (with `next`) then accept. */
export default function InvitePage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const [state, setState] = React.useState<"idle" | "busy" | "done" | "error">("idle");
  const [message, setMessage] = React.useState<string>("");

  const accept = async () => {
    setState("busy");
    try {
      const res = await post<{ name?: string }>(`/api/invites/${token}/accept`);
      setState("done");
      setMessage(`You joined ${res.name ?? "the workspace"}.`);
      setTimeout(() => {
        router.replace("/app");
        router.refresh();
      }, 800);
    } catch (e) {
      if (e instanceof ApiClientError && e.status === 401) {
        router.replace(`/login?next=${encodeURIComponent(`/invite/${token}`)}`);
        return;
      }
      setState("error");
      setMessage((e as Error).message);
      toast.error((e as Error).message);
    }
  };

  return (
    <AuthShell title="Workspace invitation" description="Accept the invitation to join a team workspace on Veyraflow.">
      <div className="flex flex-col gap-4">
        {message && <p className="text-sm">{message}</p>}
        <Button onClick={accept} disabled={state === "busy" || state === "done"}>
          {state === "busy" ? "Joining…" : state === "done" ? "Joined" : "Accept invitation"}
        </Button>
        <p className="text-muted-foreground text-xs">You need to be signed in with the e-mail address the invitation was sent to.</p>
      </div>
    </AuthShell>
  );
}
