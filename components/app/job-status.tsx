"use client";

import { Loader2Icon } from "lucide-react";
import { Badge, Progress } from "@/components/ui/primitives";
import { JOB_STATUS_LABELS, cn } from "@/lib/utils";

const TERMINAL = new Set(["completed", "failed", "rejected", "cancelled"]);

export function JobStatusBadge({ status, progress, className }: { status: string; progress?: number; className?: string }) {
  const variant = status === "completed" ? "success" : status === "failed" || status === "rejected" ? "destructive" : status === "cancelled" ? "secondary" : "outline";
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <Badge variant={variant}>
        {!TERMINAL.has(status) && <Loader2Icon className="size-3 animate-spin" />}
        {JOB_STATUS_LABELS[status] ?? status}
      </Badge>
      {status === "generating" && typeof progress === "number" && progress > 0 && <Progress value={progress} className="h-1 w-16" />}
    </span>
  );
}
