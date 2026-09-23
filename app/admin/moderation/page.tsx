"use client";

import * as React from "react";
import { toast } from "sonner";
import { AdminTable } from "@/components/admin/admin-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/primitives";
import { Select } from "@/components/ui/overlays";
import { patch } from "@/lib/client/api";
import { formatDateTime } from "@/lib/utils";

interface Ev {
  id: string;
  user_id: string;
  source: string;
  category: string | null;
  reason: string | null;
  prompt_excerpt: string | null;
  model: string | null;
  created_at: string;
  profiles: { email: string; banned_at: string | null; violations_month: number } | null;
}

const CATEGORIES = ["sexual_nudity", "extreme_violence", "drugs_extreme", "csam", "hate_extreme", "other"];

/** SPEC §19 Moderation — event list with category filter and quick ban. */
export default function AdminModerationPage() {
  const [category, setCategory] = React.useState("");
  const [refresh, setRefresh] = React.useState(0);
  const ban = async (userId: string) => {
    if (!confirm("Ban this user?")) return;
    try {
      await patch(`/api/admin/users/${userId}`, { ban: true, ban_reason: "admin:moderation" });
      toast.success("Banned");
      setRefresh((r) => r + 1);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Moderation events</h1>
      <Select size="sm" className="w-48" value={category || "all"} onValueChange={(v) => setCategory(v === "all" ? "" : v)} options={[{ value: "all", label: "All categories" }, ...CATEGORIES.map((c) => ({ value: c, label: c }))]} />
      <AdminTable<Ev>
        endpoint="/api/admin/moderation"
        rowsKey="events"
        queryKey="admin-moderation"
        extraParams={category ? { category } : {}}
        refreshToken={refresh}
        rowKey={(r) => r.id}
        columns={[
          { key: "when", header: "When", render: (r) => <span className="text-muted-foreground text-xs">{formatDateTime(r.created_at)}</span> },
          { key: "user", header: "User", render: (r) => <span>{r.profiles?.email ?? r.user_id} <span className="text-muted-foreground text-xs">({r.profiles?.violations_month ?? 0} this month)</span></span> },
          { key: "cat", header: "Category", render: (r) => <Badge variant={r.category === "csam" ? "destructive" : "secondary"}>{r.category}</Badge> },
          { key: "src", header: "Source", render: (r) => r.source },
          { key: "excerpt", header: "Prompt excerpt", render: (r) => <span className="text-muted-foreground max-w-80 truncate text-xs">{r.prompt_excerpt}</span>, className: "max-w-80 truncate" },
          { key: "act", header: "", render: (r) => (r.profiles?.banned_at ? <Badge variant="destructive">banned</Badge> : <Button size="sm" variant="ghost" onClick={() => ban(r.user_id)}>Ban</Button>) },
        ]}
      />
    </div>
  );
}
