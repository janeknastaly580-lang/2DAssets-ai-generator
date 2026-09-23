"use client";

import Link from "next/link";
import { useJobFeed } from "@/hooks/use-job-feed";
import { JobStatusBadge } from "./job-status";
import { ASSET_TYPE_LABELS, relativeTime } from "@/lib/utils";

export function ActiveJobs({ workspaceId }: { workspaceId: string }) {
  const { active, list } = useJobFeed(workspaceId);
  const show = active.length ? active : list.slice(0, 3);
  if (!show.length) return <p className="text-muted-foreground text-sm">No jobs running.</p>;
  return (
    <ul className="flex flex-col gap-2 text-sm">
      {show.map((j) => (
        <li key={j.job_id} className="flex items-center justify-between gap-2">
          <Link href={j.result_asset_ids[0] ? `/app/assets/${j.result_asset_ids[0]}` : "/app/jobs"} className="truncate hover:underline">
            {ASSET_TYPE_LABELS[j.type] ?? j.type} <span className="text-muted-foreground text-xs">{relativeTime(j.updated_at)}</span>
          </Link>
          <JobStatusBadge status={j.status} progress={j.progress} />
        </li>
      ))}
    </ul>
  );
}
