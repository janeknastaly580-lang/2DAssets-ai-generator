"use client";

import { AdminTable } from "@/components/admin/admin-table";
import { formatDateTime } from "@/lib/utils";

interface Entry {
  id: number;
  actor_id: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  payload: Record<string, unknown> | null;
  ip: string | null;
  created_at: string;
  profiles: { email: string } | null;
}

/** SPEC §19 Audit log. */
export default function AdminAuditPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Audit log</h1>
      <AdminTable<Entry>
        endpoint="/api/admin/audit"
        rowsKey="entries"
        queryKey="admin-audit"
        rowKey={(r) => String(r.id)}
        columns={[
          { key: "when", header: "When", render: (r) => <span className="text-muted-foreground text-xs">{formatDateTime(r.created_at)}</span> },
          { key: "actor", header: "Actor", render: (r) => r.profiles?.email ?? (r.actor_id ? r.actor_id.slice(0, 8) : "system") },
          { key: "action", header: "Action", render: (r) => <span className="font-mono text-xs">{r.action}</span> },
          { key: "target", header: "Target", render: (r) => <span className="text-xs">{r.target_type} {r.target_id?.slice(0, 8)}</span> },
          { key: "payload", header: "Payload", render: (r) => <span className="text-muted-foreground max-w-96 truncate text-xs">{r.payload ? JSON.stringify(r.payload) : ""}</span>, className: "max-w-96 truncate" },
          { key: "ip", header: "IP", render: (r) => <span className="text-xs">{r.ip ?? ""}</span> },
        ]}
      />
    </div>
  );
}
