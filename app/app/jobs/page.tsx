"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { XIcon, RotateCcwIcon, ExternalLinkIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, Table, TBody, TD, TH, THead, TR } from "@/components/ui/primitives";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, Select } from "@/components/ui/overlays";
import { JobStatusBadge } from "@/components/app/job-status";
import { post } from "@/lib/client/api";
import { useJobs, useProjects, useInvalidate, type JobRow } from "@/hooks/use-data";
import { ASSET_TYPE_LABELS, formatDateTime, ACTIVE_JOB_STATUSES } from "@/lib/utils";

/** SPEC §17.4 Jobs — table with live status, cost, cancel / retry-as-new / open asset, error drawer. */
export default function JobsPage() {
  const router = useRouter();
  const invalidate = useInvalidate();
  const [status, setStatus] = React.useState("all");
  const { data: projects } = useProjects();
  const jobs = useJobs({ status: status === "all" ? undefined : status, limit: "100" }, 5000);
  const [detail, setDetail] = React.useState<JobRow | null>(null);
  const projectName = (id: string | null) => projects?.find((p) => p.id === id)?.name ?? "—";

  const cancel = async (id: string) => {
    try {
      await post(`/api/jobs/${id}/cancel`);
      invalidate("jobs", "balance");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };
  const retry = (j: JobRow) => {
    router.push(`/app/generate/${j.type}?retry=${j.id}`);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Jobs</h1>
        <Select size="sm" className="w-44" value={status} onValueChange={setStatus} options={[{ value: "all", label: "All statuses" }, { value: "active", label: "Active" }, { value: "completed", label: "Completed" }, { value: "failed", label: "Failed" }, { value: "rejected", label: "Rejected" }, { value: "cancelled", label: "Cancelled" }]} />
      </div>
      {jobs.data?.length ? (
        <Table>
          <THead>
            <TR>
              <TH>Type</TH>
              <TH>Project</TH>
              <TH>Status</TH>
              <TH>Credits</TH>
              <TH>Created</TH>
              <TH />
            </TR>
          </THead>
          <TBody>
            {jobs.data.map((j) => (
              <TR key={j.id} className="cursor-pointer" onClick={() => setDetail(j)}>
                <TD>{ASSET_TYPE_LABELS[j.type]}</TD>
                <TD className="max-w-40 truncate">{projectName(j.project_id)}</TD>
                <TD><JobStatusBadge status={j.status} progress={j.progress} /></TD>
                <TD>{j.credits_charged ?? j.credits_estimated}{j.status !== "completed" && <span className="text-muted-foreground text-xs"> est.</span>}</TD>
                <TD className="text-muted-foreground text-xs">{formatDateTime(j.created_at)}</TD>
                <TD className="text-right" onClick={(e) => e.stopPropagation()}>
                  {(ACTIVE_JOB_STATUSES as readonly string[]).includes(j.status) && (
                    <Button size="sm" variant="ghost" onClick={() => cancel(j.id)}><XIcon /> Cancel</Button>
                  )}
                  {["failed", "rejected", "cancelled"].includes(j.status) && (
                    <Button size="sm" variant="ghost" onClick={() => retry(j)}><RotateCcwIcon /> Retry as new</Button>
                  )}
                  {j.result_asset_ids[0] && (
                    <Button size="sm" variant="ghost" asChild><Link href={`/app/assets/${j.result_asset_ids[0]}`}><ExternalLinkIcon /> Open</Link></Button>
                  )}
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      ) : jobs.isLoading ? null : (
        <EmptyState title="No jobs yet" />
      )}
      <Dialog open={Boolean(detail)} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{detail ? ASSET_TYPE_LABELS[detail.type] : ""} job</DialogTitle>
            <DialogDescription>{detail?.id}</DialogDescription>
          </DialogHeader>
          {detail && (
            <div className="flex flex-col gap-3 text-sm">
              <JobStatusBadge status={detail.status} progress={detail.progress} />
              {detail.error_message && (
                <div className="text-destructive rounded-md border border-destructive/40 p-3">
                  <div className="text-xs font-medium uppercase">{detail.error_code}</div>
                  {detail.error_message}
                </div>
              )}
              <div>
                <div className="text-muted-foreground mb-1 text-xs">Input</div>
                <pre className="bg-muted max-h-64 overflow-auto rounded-md p-2 text-xs">{JSON.stringify(detail.input, null, 2)}</pre>
              </div>
              <div className="text-muted-foreground text-xs">
                Estimated {detail.credits_estimated} · charged {detail.credits_charged ?? "—"} · started {formatDateTime(detail.started_at)} · finished {formatDateTime(detail.finished_at)}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
