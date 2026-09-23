"use client";

import * as React from "react";
import { toast } from "sonner";
import { AdminTable } from "@/components/admin/admin-table";
import { Button } from "@/components/ui/button";
import { Badge, Input } from "@/components/ui/primitives";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, Select } from "@/components/ui/overlays";
import { patch } from "@/lib/client/api";
import { formatBytes } from "@/lib/utils";

interface WsRow {
  id: string;
  name: string;
  type: string;
  plan: string;
  subscription_status: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  storage_used_bytes: number;
  storage_quota_bytes: number;
  member_count: number;
  owner_email: string | null;
  credit_balances: { trial_available: number; subscription_available: number; purchased_available: number; reserved: number } | null;
}

/** SPEC §19 Workspaces — plan/Stripe status/storage/members + manual plan change. */
export default function AdminWorkspacesPage() {
  const [sel, setSel] = React.useState<WsRow | null>(null);
  const [plan, setPlan] = React.useState("pro");
  const [reason, setReason] = React.useState("");
  const [refresh, setRefresh] = React.useState(0);
  const apply = async () => {
    if (!sel) return;
    try {
      await patch(`/api/admin/workspaces/${sel.id}`, { plan, reason });
      toast.success("Plan updated");
      setSel(null);
      setRefresh((r) => r + 1);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Workspaces</h1>
      <AdminTable<WsRow>
        endpoint="/api/admin/workspaces"
        rowsKey="workspaces"
        queryKey="admin-workspaces"
        searchable
        refreshToken={refresh}
        rowKey={(r) => r.id}
        onRowClick={(r) => { setSel(r); setPlan(r.plan === "none" ? "pro" : r.plan); setReason(""); }}
        columns={[
          { key: "name", header: "Workspace", render: (r) => <span>{r.name} <Badge variant="outline">{r.type}</Badge></span> },
          { key: "owner", header: "Owner", render: (r) => r.owner_email ?? "—" },
          { key: "plan", header: "Plan", render: (r) => <span>{r.plan} <span className="text-muted-foreground text-xs">{r.subscription_status}</span></span> },
          { key: "stripe", header: "Stripe", render: (r) => (r.stripe_customer_id ? <a className="underline" target="_blank" rel="noreferrer" href={`https://dashboard.stripe.com/customers/${r.stripe_customer_id}`}>{r.stripe_customer_id}</a> : "—") },
          { key: "credits", header: "Credits", render: (r) => (r.credit_balances ? r.credit_balances.trial_available + r.credit_balances.subscription_available + r.credit_balances.purchased_available - r.credit_balances.reserved : 0) },
          { key: "storage", header: "Storage", render: (r) => `${formatBytes(r.storage_used_bytes)} / ${formatBytes(r.storage_quota_bytes)}` },
          { key: "members", header: "Members", render: (r) => r.member_count },
        ]}
      />
      <Dialog open={Boolean(sel)} onOpenChange={(o) => !o && setSel(null)}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>Change plan — {sel?.name}</DialogTitle>
            <DialogDescription>Manual plan change (e.g. complimentary Studio). Logged to the audit log. Does not touch Stripe.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <Select value={plan} onValueChange={setPlan} options={["none", "trial", "pro", "studio"].map((p) => ({ value: p, label: p }))} />
            <Input placeholder="Reason" value={reason} onChange={(e) => setReason(e.target.value)} />
            <Button onClick={apply} disabled={reason.length < 3}>Apply</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
