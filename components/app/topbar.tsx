"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BellIcon, MenuIcon, SearchIcon } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/primitives";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/overlays";
import { useJobFeed } from "@/hooks/use-job-feed";
import { JOB_STATUS_LABELS, ASSET_TYPE_LABELS, relativeTime } from "@/lib/utils";

const LABELS: Record<string, string> = {
  app: "Dashboard",
  projects: "Projects",
  generate: "Generate",
  library: "Library",
  assets: "Asset",
  jobs: "Jobs",
  billing: "Billing",
  settings: "Settings",
  workspaces: "Workspaces",
  model_3d: "3D Model",
  audio_sfx: "SFX",
  audio_music: "Music",
  audio_voice: "Voice",
  new: "New",
};

/** SPEC §17.4 — topbar: breadcrumb, library search (⌘K), theme toggle, notifications bell. */
export function Topbar({ workspaceId, onMenu }: { workspaceId: string; onMenu?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const parts = pathname.split("/").filter(Boolean);
  const crumbs = parts.map((p, i) => ({ label: LABELS[p] ?? (p.length > 20 ? p.slice(0, 8) + "…" : p), href: "/" + parts.slice(0, i + 1).join("/") }));
  const { recent, unseen, markSeen } = useJobFeed(workspaceId);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        router.push("/app/library?focus=search");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  return (
    <header className="bg-background/80 sticky top-0 z-30 flex h-14 items-center gap-3 border-b px-4 backdrop-blur">
      <Button variant="ghost" size="icon" className="md:hidden" onClick={onMenu} aria-label="Menu">
        <MenuIcon />
      </Button>
      <nav className="text-muted-foreground flex min-w-0 items-center gap-1 text-sm">
        {crumbs.map((c, i) => (
          <React.Fragment key={c.href}>
            {i > 0 && <span className="opacity-50">/</span>}
            {i === crumbs.length - 1 ? <span className="text-foreground truncate font-medium">{c.label}</span> : <Link href={c.href} className="hover:text-foreground truncate">{c.label}</Link>}
          </React.Fragment>
        ))}
      </nav>
      <div className="ml-auto flex items-center gap-1">
        <Button variant="outline" size="sm" className="text-muted-foreground hidden gap-2 md:inline-flex" onClick={() => router.push("/app/library?focus=search")}>
          <SearchIcon className="size-4" /> Search library <Kbd>⌘K</Kbd>
        </Button>
        <DropdownMenu onOpenChange={(o) => o && markSeen()}>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Notifications" className="relative">
              <BellIcon />
              {unseen > 0 && <span className="bg-primary absolute top-1.5 right-1.5 size-2 rounded-full" />}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <DropdownMenuLabel>Recent jobs</DropdownMenuLabel>
            {recent.length === 0 && <div className="text-muted-foreground px-2 py-3 text-xs">No jobs yet.</div>}
            {recent.map((j) => (
              <DropdownMenuItem key={j.job_id} onSelect={() => router.push(j.result_asset_ids[0] ? `/app/assets/${j.result_asset_ids[0]}` : "/app/jobs")}>
                <div className="flex w-full flex-col">
                  <span className="text-xs">
                    {ASSET_TYPE_LABELS[j.type]} · <span className={j.status === "failed" || j.status === "rejected" ? "text-destructive" : ""}>{JOB_STATUS_LABELS[j.status]}</span>
                  </span>
                  <span className="text-muted-foreground text-[11px]">{relativeTime(j.updated_at)}</span>
                </div>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <ThemeToggle />
      </div>
    </header>
  );
}
