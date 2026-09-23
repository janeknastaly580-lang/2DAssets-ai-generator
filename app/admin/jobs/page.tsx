"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { AdminTable } from "@/components/admin/admin-table";
import { Button } from "@/components/ui/button";
import { Input, Skeleton } from "@/components/ui/primitives";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, Select } from "@/components/ui/overlays";
import { JobStatusBadge } from "@/components/app/job-status";
import { api, post } from "@/lib/client/api";
import { ASSET_TYPE_LABELS, formatDateTime } from "@/lib/utils";

interface JobRow {
  id: string;
  workspace_id: string;
  user_id: string;
  type: string;
  status: string;
  provider: string | null;
  provider_model: string | null;
  credits_estimated: number;
  credits_charged: number | null;
  provider_cost_usd: number | null;
  error_code: string | null;
  created_at: string;
}

/** SPEC §19 Jobs — full table incl. translated_prompt in the detail view; Retry / Refund. */
export default function AdminJobsPage() {
  const [status, setStatus] = React.useState("");
  const [type, setType] = React.useState("");
  const [sel, setSel] = React.useState<string | null>(null);
  const [refresh, setRefresh] = React.useState(0);
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Jobs</h1>
      <div className="flex gap-2">
        <Select size="sm" className="w-40" value={status || "all"} onValueChange={(v) => setStatus(v === "all" ? "" : v)} options={[{ value: "all", label: "All statuses" }, ...["queued", "generating", "completed", "failed", "rejected", "cancelled"].map((s) => ({ value: s, label: s }))]} />
        <Select size="sm" className="w-40" value={type || "all"} onValueChange={(v) => setType(v === "all" ? "" : v)} options={[{ value: "all", label: "All types" }, ...Object.entries(ASSET_TYPE_LABELS).map(([v, l]) => ({ value: v, label: l }))]} />
      </div>
      <AdminTable<JobRow>
        endpoint="/api/admin/jobs"
        rowsKey="jobs"
        queryKey="admin-jobs"
        extraParams={{ ...(status ? { status } : {}), ...(type ? { type } : {}) }}
        refreshToken={refresh}
        rowKey={(r) => r.id}
        onRowClick={(r) => setSel(r.id)}
        columns={[
          { key: "type", header: "Type", render: (r) => ASSET_TYPE_LABELS[r.type] },
          { key: "status", header: "Status", render: (r) => <JobStatusBadge status={r.status} /> },
          { key: "provider", header: "Provider", render: (r) => <span className="text-xs">{r.provider} / {r.provider_model}</span> },
          { key: "credits", header: "Credits", render: (r) => `${r.credits_charged ?? "—"} / est ${r.credits_estimated}` },
          { key: "cost", header: "Cost", render: (r) => (r.provider_cost_usd != null ? `$${r.provider_cost_usd}` : "—") },
          { key: "err", header: "Error", render: (r) => <span className="text-destructive text-xs">{r.error_code}</span> },
          { key: "created", header: "Created", render: (r) => <span className="text-muted-foreground text-xs">{formatDateTime(r.created_at)}</span> },
        ]}
      />
      <JobDialog id={sel} onClose={() => { setSel(null); setRefresh((r) => r + 1); }} />
    </div>
  );
}

function JobDialog({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { data } = useQuery<Record<string, unknown> & { user?: { email: string }; input: unknown; translated_prompt: unknown }>({ queryKey: ["admin-job", id], queryFn: () => api(`/api/admin/jobs/${id}`), enabled: Boolean(id) });
  const [reason, setReason] = React.useState("");
  if (!id) return null;
  const act = async (mode: "retry" | "refund") => {
    try {
      const res = await post<{ new_job_id?: string; refunded?: number }>(`/api/admin/jobs/${id}/retry`, { mode, reason });
      toast.success(mode === "retry" ? `New job ${res.new_job_id}` : `Refunded ${res.refunded} credits`);
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Job {id.slice(0, 8)}…</DialogTitle>
          <DialogDescription>{data?.user?.email}</DialogDescription>
        </DialogHeader>
        {!data ? (
          <Skeleton className="h-64" />
        ) : (
          <div className="flex flex-col gap-3 text-xs">
            <div className="flex flex-wrap gap-2"><JobStatusBadge status={String(data.status)} /> <span className="text-muted-foreground">{String(data.provider)} / {String(data.provider_model)} · provider job {String(data.provider_job_id ?? "—")}</span></div>
            {data.error_message ? <div className="text-destructive rounded border border-destructive/40 p-2">{String(data.error_code)}: {String(data.error_message)}</div> : null}
            <div className="grid gap-2 md:grid-cols-2">
              <div><div className="mb-1 font-medium">Input</div><pre className="bg-muted max-h-56 overflow-auto rounded p-2">{JSON.stringify(data.input, null, 2)}</pre></div>
              <div><div className="mb-1 font-medium">Translated prompt (hidden from users)</div><pre className="bg-muted max-h-56 overflow-auto rounded p-2">{JSON.stringify(data.translated_prompt, null, 2)}</pre></div>
            </div>
            <div className="text-muted-foreground">translator {String(data.translator_model)} v{String(data.translator_prompt_version)} · moderation {String(data.moderation_model)} v{String(data.moderation_prompt_version)} · credits {String(data.credits_charged ?? "—")} / est {String(data.credits_estimated)} · cost ${String(data.provider_cost_usd ?? "—")}</div>
            <div className="flex flex-wrap gap-2 rounded border p-2">
              <Input className="h-8 flex-1" placeholder="Reason (audited)" value={reason} onChange={(e) => setReason(e.target.value)} />
              <Button size="sm" variant="outline" disabled={reason.length < 3} onClick={() => act("retry")}>Retry (system cost)</Button>
              <Button size="sm" variant="outline" disabled={reason.length < 3 || !data.credits_charged} onClick={() => act("refund")}>Refund credits</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
