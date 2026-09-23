"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { AdminTable } from "@/components/admin/admin-table";
import { Button } from "@/components/ui/button";
import { Badge, Input, Label, Skeleton } from "@/components/ui/primitives";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, Select } from "@/components/ui/overlays";
import { api, patch, post, del } from "@/lib/client/api";
import { formatDateTime } from "@/lib/utils";

interface UserRow {
  id: string;
  email: string;
  display_name: string | null;
  role: string;
  plan: string;
  credits: number;
  violations_month: number;
  banned_at: string | null;
  ban_reason: string | null;
  created_at: string;
  personal_workspace_id: string | null;
}

interface UserDetail {
  user: UserRow & { trial_used_at: string | null; tos_version: string | null };
  memberships: { role: string; workspaces: { id: string; name: string; type: string; plan: string; credit_balances: { trial_available: number; subscription_available: number; purchased_available: number; reserved: number } | null } }[];
  jobs: { id: string; type: string; status: string; credits_charged: number | null; created_at: string; error_code: string | null }[];
  moderation_events: { id: string; category: string | null; source: string; created_at: string; prompt_excerpt: string | null }[];
  ledger: { id: number; kind: string; delta: number; description: string | null; created_at: string }[];
}

/** SPEC §19 Users. */
export default function AdminUsersPage() {
  const [selected, setSelected] = React.useState<string | null>(null);
  const [refresh, setRefresh] = React.useState(0);
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Users</h1>
      <AdminTable<UserRow>
        endpoint="/api/admin/users"
        rowsKey="users"
        queryKey="admin-users"
        searchable
        rowKey={(r) => r.id}
        refreshToken={refresh}
        onRowClick={(r) => setSelected(r.id)}
        columns={[
          { key: "email", header: "E-mail", render: (r) => <span>{r.email}{r.display_name && <span className="text-muted-foreground ml-2 text-xs">{r.display_name}</span>}</span> },
          { key: "role", header: "Role", render: (r) => <Badge variant={r.role === "admin" ? "default" : "outline"}>{r.role}</Badge> },
          { key: "plan", header: "Plan", render: (r) => r.plan },
          { key: "credits", header: "Credits", render: (r) => r.credits },
          { key: "violations", header: "Violations", render: (r) => r.violations_month },
          { key: "ban", header: "Status", render: (r) => (r.banned_at ? <Badge variant="destructive">banned</Badge> : <Badge variant="success">active</Badge>) },
          { key: "created", header: "Created", render: (r) => <span className="text-muted-foreground text-xs">{formatDateTime(r.created_at)}</span> },
        ]}
      />
      <UserDialog id={selected} onClose={() => { setSelected(null); setRefresh((r) => r + 1); }} />
    </div>
  );
}

function UserDialog({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { data, refetch } = useQuery<UserDetail>({ queryKey: ["admin-user", id], queryFn: () => api(`/api/admin/users/${id}`), enabled: Boolean(id) });
  const [amount, setAmount] = React.useState("");
  const [reason, setReason] = React.useState("");
  const [wsId, setWsId] = React.useState("");
  const [banReason, setBanReason] = React.useState("");
  React.useEffect(() => {
    if (data && !wsId) setWsId(data.memberships[0]?.workspaces.id ?? "");
  }, [data, wsId]);
  if (!id) return null;
  const u = data?.user;
  const run = async (fn: () => Promise<unknown>, msg: string) => {
    try {
      await fn();
      toast.success(msg);
      refetch();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="xl">
        <DialogHeader>
          <DialogTitle>{u?.email ?? "User"}</DialogTitle>
          <DialogDescription>{id}</DialogDescription>
        </DialogHeader>
        {!data ? (
          <Skeleton className="h-64" />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-3 text-sm">
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">{u!.role}</Badge>
                {u!.banned_at && <Badge variant="destructive">banned: {u!.ban_reason}</Badge>}
                <Badge variant="secondary">{u!.violations_month} violations</Badge>
                {u!.trial_used_at && <Badge variant="secondary">trial used</Badge>}
              </div>
              <div className="rounded-md border p-3">
                <div className="mb-2 text-xs font-medium">Adjust credits (usage bucket)</div>
                <div className="flex flex-wrap gap-2">
                  <Select size="sm" className="w-48" value={wsId} onValueChange={setWsId} options={data.memberships.map((m) => ({ value: m.workspaces.id, label: `${m.workspaces.name} (${m.workspaces.plan})` }))} />
                  <Input className="h-8 w-24" placeholder="±100" value={amount} onChange={(e) => setAmount(e.target.value)} />
                  <Input className="h-8 flex-1" placeholder="Reason" value={reason} onChange={(e) => setReason(e.target.value)} />
                  <Button size="sm" disabled={!amount || reason.length < 3 || !wsId} onClick={() => run(() => post(`/api/admin/users/${id}/credits`, { workspace_id: wsId, amount: Number(amount), reason }), "Credits adjusted")}>Apply</Button>
                </div>
              </div>
              <div className="rounded-md border p-3">
                <div className="mb-2 text-xs font-medium">Moderation & access</div>
                <div className="flex flex-wrap gap-2">
                  {u!.banned_at ? (
                    <Button size="sm" variant="outline" onClick={() => run(() => patch(`/api/admin/users/${id}`, { ban: false }), "Unbanned")}>Unban</Button>
                  ) : (
                    <>
                      <Input className="h-8 w-48" placeholder="Ban reason" value={banReason} onChange={(e) => setBanReason(e.target.value)} />
                      <Button size="sm" variant="destructive" disabled={!banReason} onClick={() => run(() => patch(`/api/admin/users/${id}`, { ban: true, ban_reason: banReason }), "Banned")}>Ban</Button>
                    </>
                  )}
                  <Button size="sm" variant="outline" onClick={() => run(() => patch(`/api/admin/users/${id}`, { role: u!.role === "admin" ? "user" : "admin" }), "Role updated")}>{u!.role === "admin" ? "Revoke admin" : "Make admin"}</Button>
                  <Button size="sm" variant="outline" onClick={() => run(() => patch(`/api/admin/users/${id}`, { sign_out: true }), "Signed out")}>Force sign-out</Button>
                  <Button size="sm" variant="destructive" onClick={() => confirm("Permanently delete this account (GDPR)?") && run(async () => { await del(`/api/admin/users/${id}`); onClose(); }, "Deleted")}>Delete account</Button>
                </div>
              </div>
              <div>
                <Label className="mb-1 text-xs">Workspaces</Label>
                <ul className="divide-y rounded-md border text-xs">
                  {data.memberships.map((m) => {
                    const b = m.workspaces.credit_balances;
                    return (
                      <li key={m.workspaces.id} className="flex justify-between p-2">
                        <span>{m.workspaces.name} · {m.workspaces.type} · {m.workspaces.plan} · {m.role}</span>
                        <span className="text-muted-foreground">{b ? `${b.trial_available + b.subscription_available + b.purchased_available - b.reserved} credits` : "—"}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
            <div className="flex flex-col gap-3 text-xs">
              <div>
                <Label className="mb-1 text-xs">Recent jobs</Label>
                <ul className="max-h-40 divide-y overflow-y-auto rounded-md border">
                  {data.jobs.map((j) => (
                    <li key={j.id} className="flex justify-between p-2"><span>{j.type} · {j.status}{j.error_code ? ` (${j.error_code})` : ""}</span><span className="text-muted-foreground">{formatDateTime(j.created_at)}</span></li>
                  ))}
                  {!data.jobs.length && <li className="text-muted-foreground p-2">None</li>}
                </ul>
              </div>
              <div>
                <Label className="mb-1 text-xs">Moderation events</Label>
                <ul className="max-h-40 divide-y overflow-y-auto rounded-md border">
                  {data.moderation_events.map((e) => (
                    <li key={e.id} className="p-2"><span className="font-medium">{e.category}</span> · {e.source} · <span className="text-muted-foreground">{e.prompt_excerpt}</span></li>
                  ))}
                  {!data.moderation_events.length && <li className="text-muted-foreground p-2">None</li>}
                </ul>
              </div>
              <div>
                <Label className="mb-1 text-xs">Ledger</Label>
                <ul className="max-h-40 divide-y overflow-y-auto rounded-md border">
                  {data.ledger.map((l) => (
                    <li key={l.id} className="flex justify-between p-2"><span>{l.kind} · {l.description}</span><span className={l.delta < 0 ? "text-destructive" : "text-emerald-500"}>{l.delta}</span></li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
