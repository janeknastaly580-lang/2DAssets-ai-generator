"use client";

import * as React from "react";
import Link from "next/link";
import { FolderIcon, PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge, EmptyState, Skeleton } from "@/components/ui/primitives";
import { ProjectDialog } from "@/components/projects/project-dialog";
import { useProjects } from "@/hooks/use-data";

/** SPEC §17.4 Projects — grid of cards + "New project" modal. */
export default function ProjectsPage() {
  const { data, isLoading } = useProjects();
  const [open, setOpen] = React.useState(false);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Projects</h1>
        <Button onClick={() => setOpen(true)}>
          <PlusIcon /> New project
        </Button>
      </div>
      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-36" />
          ))}
        </div>
      ) : data?.length ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((p) => (
            <Link key={p.id} href={`/app/projects/${p.id}`} className="bg-card hover:border-primary/50 flex flex-col gap-2 rounded-lg border p-4 transition-colors">
              <div className="flex items-center gap-2">
                <FolderIcon className="text-primary size-4" />
                <span className="font-medium">{p.name}</span>
                {p.is_scratch && <Badge variant="secondary">Scratch</Badge>}
              </div>
              <p className="text-muted-foreground line-clamp-2 text-sm">{p.description || (p.is_scratch ? "Quick experiments without a style guide." : "No description")}</p>
              <div className="text-muted-foreground mt-auto flex items-center justify-between text-xs">
                <span>{p.asset_count ?? 0} assets</span>
                <span className="flex items-center gap-2">
                  {p.style_guide?.art_style && <Badge variant="outline">{p.style_guide.art_style}</Badge>}
                  {p.style_guide?.palette?.length ? (
                    <span className="flex gap-0.5">
                      {p.style_guide.palette.slice(0, 6).map((c, i) => (
                        <span key={i} className="size-3 rounded-sm border" style={{ background: c }} />
                      ))}
                    </span>
                  ) : null}
                </span>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState title="No projects" description="Create a project with a style guide to keep your assets consistent." action={<Button onClick={() => setOpen(true)}>New project</Button>} />
      )}
      <ProjectDialog open={open} onOpenChange={setOpen} />
    </div>
  );
}
