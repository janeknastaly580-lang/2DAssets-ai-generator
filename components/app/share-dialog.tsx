"use client";

import * as React from "react";
import { CopyIcon, CheckIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/primitives";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Select, Switch } from "@/components/ui/overlays";
import { post } from "@/lib/client/api";
import { track } from "@/lib/analytics";

/** SPEC §18 — create a private link; the URL is shown once. */
export function ShareDialog({ open, onOpenChange, target }: { open: boolean; onOpenChange: (o: boolean) => void; target: { type: "asset" | "project"; id: string } }) {
  const [download, setDownload] = React.useState(false);
  const [showPrompt, setShowPrompt] = React.useState(false);
  const [expires, setExpires] = React.useState("30");
  const [url, setUrl] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setUrl(null);
      setCopied(false);
    }
  }, [open]);

  const create = async () => {
    setBusy(true);
    try {
      const res = await post<{ url: string }>("/api/share", {
        target_type: target.type,
        target_id: target.id,
        allow_download: download,
        show_prompt: showPrompt,
        expires_in_days: expires === "never" ? null : Number(expires),
      });
      setUrl(res.url);
      track("share", { method: "link", content_type: target.type });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (!url) return;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success("Link copied");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Share {target.type}</DialogTitle>
          <DialogDescription>Anyone with the link can view. Links are private and not listed anywhere.</DialogDescription>
        </DialogHeader>
        {url ? (
          <div className="flex flex-col gap-2">
            <Label>Your link (shown once)</Label>
            <div className="flex gap-2">
              <Input readOnly value={url} onFocus={(e) => e.target.select()} />
              <Button variant="outline" size="icon" onClick={copy} aria-label="Copy">
                {copied ? <CheckIcon /> : <CopyIcon />}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <label className="flex items-center justify-between text-sm">
              Allow download <Switch checked={download} onCheckedChange={setDownload} />
            </label>
            <label className="flex items-center justify-between text-sm">
              Show original prompt <Switch checked={showPrompt} onCheckedChange={setShowPrompt} />
            </label>
            <div className="grid gap-2">
              <Label>Expires</Label>
              <Select value={expires} onValueChange={setExpires} options={[{ value: "7", label: "7 days" }, { value: "30", label: "30 days" }, { value: "90", label: "90 days" }, { value: "never", label: "Never" }]} />
            </div>
          </div>
        )}
        <DialogFooter>
          {url ? (
            <Button onClick={() => onOpenChange(false)}>Done</Button>
          ) : (
            <Button onClick={create} disabled={busy}>
              {busy ? "Creating…" : "Create link"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
