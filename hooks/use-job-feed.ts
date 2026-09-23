"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { JOB_STATUS_LABELS, ASSET_TYPE_LABELS } from "@/lib/utils";

export interface FeedRow {
  job_id: string;
  workspace_id: string;
  user_id: string;
  type: string;
  status: string;
  progress: number;
  error_code: string | null;
  result_asset_ids: string[];
  updated_at: string;
}

const TERMINAL = new Set(["completed", "failed", "rejected", "cancelled"]);
/** Shared across hook instances (topbar, dashboard, generator) so a job completion toasts once. */
const notified = new Set<string>();
let channelSeq = 0;

/**
 * Live job status (SPEC §3, §15.3): Supabase Realtime on `job_status_feed` filtered by workspace,
 * with a 4-second polling fallback while any job is active. Emits toasts on completion.
 */
export function useJobFeed(workspaceId: string) {
  const qc = useQueryClient();
  const [rows, setRows] = React.useState<Map<string, FeedRow>>(new Map());
  const rowsRef = React.useRef(rows);
  rowsRef.current = rows;
  const [seenAt, setSeenAt] = React.useState<number>(() => Date.now());

  const upsert = React.useCallback(
    (r: FeedRow) => {
      const before = rowsRef.current.get(r.job_id);
      setRows((prev) => {
        const next = new Map(prev);
        next.set(r.job_id, r);
        return next;
      });
      if (TERMINAL.has(r.status) && before && !TERMINAL.has(before.status) && !notified.has(r.job_id)) {
        notified.add(r.job_id);
        const label = `${ASSET_TYPE_LABELS[r.type] ?? r.type}: ${JOB_STATUS_LABELS[r.status] ?? r.status}`;
        if (r.status === "completed") toast.success(label);
        else toast.error(label);
        qc.invalidateQueries({ queryKey: ["assets"] });
        qc.invalidateQueries({ queryKey: ["balance"] });
        qc.invalidateQueries({ queryKey: ["projects"] });
        qc.invalidateQueries({ queryKey: ["asset"] });
      }
      qc.invalidateQueries({ queryKey: ["jobs"] });
    },
    [qc],
  );

  // initial load + polling fallback while jobs are active
  React.useEffect(() => {
    if (!workspaceId) return;
    let stop = false;
    const load = async () => {
      const sb = supabaseBrowser();
      const { data } = await sb
        .from("job_status_feed")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("updated_at", { ascending: false })
        .limit(30);
      if (stop || !data) return;
      for (const r of data as FeedRow[]) {
        const before = rowsRef.current.get(r.job_id);
        if (!before || before.updated_at !== r.updated_at || before.status !== r.status) upsert(r);
      }
    };
    void load();
    const interval = setInterval(() => {
      const active = Array.from(rowsRef.current.values()).some((r) => !TERMINAL.has(r.status));
      if (active) void load();
    }, 4000);
    return () => {
      stop = true;
      clearInterval(interval);
    };
  }, [workspaceId, upsert]);

  // realtime (unique channel name per hook instance — Supabase rejects duplicate topics)
  React.useEffect(() => {
    if (!workspaceId) return;
    const sb = supabaseBrowser();
    const channel = sb
      .channel(`jobs:${workspaceId}:${++channelSeq}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "job_status_feed", filter: `workspace_id=eq.${workspaceId}` },
        (payload) => {
          const r = (payload.new ?? payload.old) as FeedRow;
          if (r?.job_id) upsert(r);
        },
      )
      .subscribe();
    return () => {
      void sb.removeChannel(channel);
    };
  }, [workspaceId, upsert]);

  const list = React.useMemo(() => Array.from(rows.values()).sort((a, b) => b.updated_at.localeCompare(a.updated_at)), [rows]);
  const active = list.filter((r) => !TERMINAL.has(r.status));
  const recent = list.slice(0, 8);
  const unseen = list.filter((r) => TERMINAL.has(r.status) && new Date(r.updated_at).getTime() > seenAt).length;
  return { rows, list, active, recent, unseen, markSeen: () => setSeenAt(Date.now()), get: (id: string) => rows.get(id) };
}
