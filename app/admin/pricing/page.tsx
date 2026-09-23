"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Skeleton, Table, TBody, TD, TH, THead, TR } from "@/components/ui/primitives";
import { Switch } from "@/components/ui/overlays";
import { api, put } from "@/lib/client/api";

interface Pricing {
  id: string;
  pipeline: string;
  provider: string;
  provider_model: string;
  credits: number;
  est_provider_cost_usd: number;
  enabled: boolean;
  params: Record<string, unknown>;
  updated_at: string;
}

/** SPEC §19 Pricing — edit model_pricing inline; changes are immediate and audited. */
export default function AdminPricingPage() {
  const { data, isLoading, refetch } = useQuery<Pricing[]>({ queryKey: ["admin-pricing"], queryFn: () => api("/api/admin/pricing") });
  const [edits, setEdits] = React.useState<Record<string, Partial<Pricing>>>({});
  const save = async (id: string) => {
    try {
      await put("/api/admin/pricing", { id, ...edits[id] });
      toast.success("Saved");
      setEdits((e) => ({ ...e, [id]: {} }));
      refetch();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };
  if (isLoading || !data) return <Skeleton className="h-96" />;
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Pricing (model_pricing)</h1>
      <Table>
        <THead>
          <TR><TH>ID</TH><TH>Pipeline</TH><TH>Provider</TH><TH>Model</TH><TH>Credits</TH><TH>Est. cost USD</TH><TH>Enabled</TH><TH /></TR>
        </THead>
        <TBody>
          {data.map((r) => {
            const e = edits[r.id] ?? {};
            const dirty = Object.keys(e).length > 0;
            return (
              <TR key={r.id}>
                <TD className="font-mono text-xs">{r.id}</TD>
                <TD>{r.pipeline}</TD>
                <TD>{r.provider}</TD>
                <TD><Input className="h-8 w-52" value={e.provider_model ?? r.provider_model} onChange={(ev) => setEdits((s) => ({ ...s, [r.id]: { ...e, provider_model: ev.target.value } }))} /></TD>
                <TD><Input type="number" className="h-8 w-20" value={e.credits ?? r.credits} onChange={(ev) => setEdits((s) => ({ ...s, [r.id]: { ...e, credits: Number(ev.target.value) } }))} /></TD>
                <TD><Input type="number" step="0.0001" className="h-8 w-24" value={e.est_provider_cost_usd ?? r.est_provider_cost_usd} onChange={(ev) => setEdits((s) => ({ ...s, [r.id]: { ...e, est_provider_cost_usd: Number(ev.target.value) } }))} /></TD>
                <TD><Switch checked={e.enabled ?? r.enabled} onCheckedChange={(v) => setEdits((s) => ({ ...s, [r.id]: { ...e, enabled: v } }))} /></TD>
                <TD><Button size="sm" disabled={!dirty} onClick={() => save(r.id)}>Save</Button></TD>
              </TR>
            );
          })}
        </TBody>
      </Table>
    </div>
  );
}
