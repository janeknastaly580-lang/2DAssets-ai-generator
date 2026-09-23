"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { DownloadIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Skeleton, Table, TBody, TD, TH, THead, TR } from "@/components/ui/primitives";
import { api } from "@/lib/client/api";

interface CostRow {
  pipeline: string;
  provider: string;
  model: string;
  jobs: number;
  credits: number;
  cost_usd: number;
  cost_per_job: number;
  credits_per_job: number;
  margin_at_cost_basis: number;
}

/** SPEC §19 Costs — aggregates per pipeline/provider/model with CSV export. */
export default function AdminCostsPage() {
  const [from, setFrom] = React.useState(() => new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10));
  const [to, setTo] = React.useState(() => new Date().toISOString().slice(0, 10));
  const qs = `from=${from}&to=${to}T23:59:59Z`;
  const { data, isLoading } = useQuery<{ rows: CostRow[] }>({ queryKey: ["admin-costs", qs], queryFn: () => api(`/api/admin/costs?${qs}`) });
  const totals = (data?.rows ?? []).reduce((s, r) => ({ jobs: s.jobs + r.jobs, credits: s.credits + r.credits, cost: s.cost + r.cost_usd }), { jobs: 0, credits: 0, cost: 0 });
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Costs</h1>
      <div className="flex flex-wrap items-center gap-2">
        <Input type="date" className="w-40" value={from} onChange={(e) => setFrom(e.target.value)} />
        <span className="text-muted-foreground text-sm">to</span>
        <Input type="date" className="w-40" value={to} onChange={(e) => setTo(e.target.value)} />
        <Button asChild variant="outline" size="sm"><a href={`/api/admin/costs?${qs}&format=csv`}><DownloadIcon /> Export CSV</a></Button>
      </div>
      {isLoading ? (
        <Skeleton className="h-64" />
      ) : (
        <Table>
          <THead>
            <TR><TH>Pipeline</TH><TH>Provider</TH><TH>Model</TH><TH className="text-right">Jobs</TH><TH className="text-right">Credits</TH><TH className="text-right">Cost USD</TH><TH className="text-right">Cost / job</TH><TH className="text-right">Credits / job</TH><TH className="text-right">Margin @ cost basis</TH></TR>
          </THead>
          <TBody>
            {(data?.rows ?? []).map((r) => (
              <TR key={`${r.pipeline}${r.provider}${r.model}`}>
                <TD>{r.pipeline}</TD><TD>{r.provider}</TD><TD className="text-xs">{r.model}</TD>
                <TD className="text-right">{r.jobs}</TD><TD className="text-right">{r.credits}</TD><TD className="text-right">${r.cost_usd}</TD>
                <TD className="text-right">${r.cost_per_job}</TD><TD className="text-right">{r.credits_per_job}</TD>
                <TD className={`text-right ${r.margin_at_cost_basis < 0 ? "text-destructive" : ""}`}>{r.margin_at_cost_basis}%</TD>
              </TR>
            ))}
            <TR className="font-medium"><TD colSpan={3}>Total</TD><TD className="text-right">{totals.jobs}</TD><TD className="text-right">{totals.credits}</TD><TD className="text-right">${totals.cost.toFixed(4)}</TD><TD colSpan={3} /></TR>
          </TBody>
        </Table>
      )}
      <p className="text-muted-foreground text-xs">1 credit = $0.01 cost basis (SPEC §11.1). Margin here excludes Stripe fees and the credit sale price — it shows whether pricing per pipeline covers provider cost.</p>
    </div>
  );
}
