"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Skeleton, Table, TBody, TD, TH, THead, TR, Textarea } from "@/components/ui/primitives";
import { Switch } from "@/components/ui/overlays";
import { api, put, post } from "@/lib/client/api";

interface Flag {
  key: string;
  enabled: boolean;
  payload: Record<string, unknown>;
  updated_at: string;
}

/** SPEC §19 Flags — feature flags + on-demand maintenance tasks. */
export default function AdminFlagsPage() {
  const { data, isLoading, refetch } = useQuery<Flag[]>({ queryKey: ["admin-flags"], queryFn: () => api("/api/admin/flags") });
  const [payloads, setPayloads] = React.useState<Record<string, string>>({});
  const [newKey, setNewKey] = React.useState("");
  const save = async (key: string, enabled?: boolean) => {
    try {
      const raw = payloads[key];
      const payload = raw !== undefined ? JSON.parse(raw) : undefined;
      await put("/api/admin/flags", { key, enabled, payload });
      toast.success("Saved");
      refetch();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };
  const runTask = async (task: string) => {
    try {
      const res = await post<{ result: unknown }>("/api/admin/maintenance", { task });
      toast.success(`${task}: ${JSON.stringify(res.result)}`);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };
  if (isLoading || !data) return <Skeleton className="h-96" />;
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Feature flags</h1>
      <Table>
        <THead><TR><TH>Key</TH><TH>Enabled</TH><TH>Payload (JSON)</TH><TH /></TR></THead>
        <TBody>
          {data.map((f) => (
            <TR key={f.key}>
              <TD className="font-mono text-xs">{f.key}</TD>
              <TD><Switch checked={f.enabled} onCheckedChange={(v) => save(f.key, v)} /></TD>
              <TD><Textarea className="min-h-9 w-96 font-mono text-xs" value={payloads[f.key] ?? JSON.stringify(f.payload)} onChange={(e) => setPayloads((p) => ({ ...p, [f.key]: e.target.value }))} /></TD>
              <TD><Button size="sm" variant="outline" onClick={() => save(f.key)} disabled={payloads[f.key] === undefined}>Save payload</Button></TD>
            </TR>
          ))}
        </TBody>
      </Table>
      <div className="flex gap-2">
        <Input className="w-64" placeholder="new.flag.key" value={newKey} onChange={(e) => setNewKey(e.target.value)} />
        <Button variant="outline" onClick={() => newKey && save(newKey, false).then(() => setNewKey(""))}>Add flag</Button>
      </div>
      <div>
        <h2 className="mb-2 font-semibold">Maintenance tasks (run now)</h2>
        <p className="text-muted-foreground mb-2 text-xs">These run automatically on Upstash schedules in production (SPEC §14.1). Use here to trigger them locally or on demand.</p>
        <div className="flex flex-wrap gap-2">
          {[["retention", "Retention cleanup"], ["expire_credits", "Expire credits"], ["voices", "Refresh voice cache"], ["violations", "Reset violation counters"], ["deletions", "Process account deletions"]].map(([t, l]) => (
            <Button key={t} size="sm" variant="outline" onClick={() => runTask(t)}>{l}</Button>
          ))}
        </div>
      </div>
    </div>
  );
}
