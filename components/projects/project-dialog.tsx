"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/primitives";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/overlays";
import { StyleGuideForm } from "./style-guide-form";
import { post, patch } from "@/lib/client/api";
import { useInvalidate, type ProjectRow } from "@/hooks/use-data";
import type { StyleGuide } from "@/lib/validation/project";

export function ProjectDialog({ open, onOpenChange, project, onSaved }: { open: boolean; onOpenChange: (o: boolean) => void; project?: ProjectRow | null; onSaved?: (p: ProjectRow) => void }) {
  const router = useRouter();
  const invalidate = useInvalidate();
  const [name, setName] = React.useState(project?.name ?? "");
  const [description, setDescription] = React.useState(project?.description ?? "");
  const [sg, setSg] = React.useState<StyleGuide>(project?.style_guide ?? { palette_locked: false });
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setName(project?.name ?? "");
      setDescription(project?.description ?? "");
      setSg(project?.style_guide ?? { palette_locked: false });
    }
  }, [open, project]);

  const save = async () => {
    setBusy(true);
    try {
      const body = { name, description, style_guide: sg };
      const saved = project ? await patch<ProjectRow>(`/api/projects/${project.id}`, body) : await post<ProjectRow>("/api/projects", body);
      toast.success(project ? "Project updated" : "Project created");
      invalidate("projects", "project");
      onOpenChange(false);
      onSaved?.(saved);
      if (!project) router.push(`/app/projects/${saved.id}`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{project ? "Edit project" : "New project"}</DialogTitle>
          <DialogDescription>A project groups the assets of one game and keeps their style consistent.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="My roguelike" maxLength={80} />
          </div>
          <div className="grid gap-2">
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional" />
          </div>
          <StyleGuideForm value={sg} onChange={setSg} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={save} disabled={busy || name.trim().length < 1}>
            {busy ? "Saving…" : project ? "Save" : "Create project"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
