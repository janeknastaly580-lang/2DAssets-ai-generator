"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, Skeleton } from "@/components/ui/primitives";
import { JobStatusBadge } from "@/components/app/job-status";
import { api } from "@/lib/client/api";
import { ASSET_TYPE_LABELS, formatDateTime } from "@/lib/utils";

interface Overview {
  users: number;
  active_subscriptions: number;
  jobs_24h: Record<string, number>;
  credits_used_24h: number;
  credits_used_30d: number;
  provider_cost_24h: number;
  provider_cost_30d: number;
  estimated_gross_margin_30d: number | null;
  series_30d: { day: string; jobs: number; credits: number; cost: number }[];
  recent_jobs: { id: string; type: string; status: string; created_at: string; credits_estimated: number; error_code: string | null }[];
}

/** SPEC §19 Overview. */
export default function AdminOverview() {
  const { data, isLoading } = useQuery<Overview>({ queryKey: ["admin-overview"], queryFn: () => api("/api/admin/overview"), refetchInterval: 30_000 });
  if (isLoading || !data) return <Skeleton className="h-96" />;
  const max = Math.max(1, ...data.series_30d.map((s) => s.jobs));
  const stats = [
    ["Users", data.users],
    ["Active subscriptions", data.active_subscriptions],
    ["Credits used (24 h / 30 d)", `${data.credits_used_24h} / ${data.credits_used_30d}`],
    ["Provider cost (24 h / 30 d)", `$${data.provider_cost_24h} / $${data.provider_cost_30d}`],
    ["Est. gross margin at cost basis (30 d)", data.estimated_gross_margin_30d == null ? "—" : `${data.estimated_gross_margin_30d}%`],
    ["Jobs 24 h", Object.entries(data.jobs_24h).map(([k, v]) => `${k}: ${v}`).join(", ") || "0"],
  ];
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Overview</h1>
      <div className="grid gap-3 md:grid-cols-3">
        {stats.map(([k, v]) => (
          <Card key={String(k)}>
            <CardHeader><CardTitle className="text-muted-foreground text-xs font-normal">{k}</CardTitle></CardHeader>
            <CardContent className="text-xl font-semibold">{v}</CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader><CardTitle>Jobs per day (30 d)</CardTitle></CardHeader>
        <CardContent>
          <div className="flex h-32 items-end gap-1">
            {data.series_30d.map((s) => (
              <div key={s.day} className="bg-primary/70 flex-1 rounded-t" style={{ height: `${(s.jobs / max) * 100}%` }} title={`${s.day}: ${s.jobs} jobs, ${s.credits} credits, $${s.cost}`} />
            ))}
            {!data.series_30d.length && <p className="text-muted-foreground text-sm">No data</p>}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Recent jobs</CardTitle></CardHeader>
        <CardContent>
          <ul className="divide-y text-sm">
            {data.recent_jobs.map((j) => (
              <li key={j.id} className="flex items-center justify-between py-1.5">
                <span>{ASSET_TYPE_LABELS[j.type]} <span className="text-muted-foreground text-xs">{formatDateTime(j.created_at)}</span></span>
                <JobStatusBadge status={j.status} />
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
