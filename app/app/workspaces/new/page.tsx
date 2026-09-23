"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Label } from "@/components/ui/primitives";
import { post } from "@/lib/client/api";
import { PLANS } from "@/lib/plans";

/** SPEC §6 — create a team workspace; it becomes writable once Studio is active. */
export default function NewWorkspacePage() {
  const router = useRouter();
  const [name, setName] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const create = async () => {
    setBusy(true);
    try {
      const res = await post<{ workspace: { id: string } }>("/api/workspaces", { name });
      await post(`/api/workspaces/${res.workspace.id}/switch`);
      toast.success("Team workspace created — activate Studio to start generating");
      router.push("/app/billing?buy=studio");
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
      setBusy(false);
    }
  };
  return (
    <Card className="max-w-lg">
      <CardHeader>
        <CardTitle>New team workspace</CardTitle>
        <CardDescription>
          Team workspaces share projects and credits. They require the Studio plan (${PLANS.studio.priceUsd}/month, {PLANS.studio.seats} seats). You will be taken to checkout after creating it.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid gap-2">
          <Label>Workspace name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Pixel Forge Studio" maxLength={60} />
        </div>
        <Button onClick={create} disabled={busy || name.trim().length < 2}>{busy ? "Creating…" : "Create and choose Studio"}</Button>
      </CardContent>
    </Card>
  );
}
