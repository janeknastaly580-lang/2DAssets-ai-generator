"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, Avatar, Badge, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Label, Skeleton, Table, TBody, TD, TH, THead, TR } from "@/components/ui/primitives";
import { Select, Switch, Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/overlays";
import { openConsentManager } from "@/components/cookie-banner";
import { api, del, patch, post, uploadImage } from "@/lib/client/api";
import { useInvalidate } from "@/hooks/use-data";
import { formatDateTime } from "@/lib/utils";

interface Account {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  marketing_consent: boolean;
  notification_prefs: { job_completed?: boolean; assets_expiring?: boolean };
  tos_version: string | null;
  tos_current: string;
  role: string;
}

interface WorkspaceInfo {
  id: string;
  name: string;
  type: string;
  role: string;
  owner_id: string;
  seats: number;
  members: { user_id: string; role: string; joined_at: string; profiles: { display_name: string | null; email: string } | null }[];
}

function SettingsInner() {
  const sp = useSearchParams();
  const router = useRouter();
  const invalidate = useInvalidate();
  const { data: me, isLoading } = useQuery<Account>({ queryKey: ["account"], queryFn: () => api("/api/account") });
  const { data: workspaces } = useQuery<(WorkspaceInfo & { role: string })[]>({ queryKey: ["workspaces"], queryFn: () => api("/api/workspaces") });
  const [name, setName] = React.useState("");
  const [pw, setPw] = React.useState({ current: "", password: "", confirm: "" });
  const [wsId, setWsId] = React.useState<string>("");
  const ws = useQuery<WorkspaceInfo & { invites?: { id: string; email: string; role: string; expires_at: string }[] }>({ queryKey: ["workspace", wsId], queryFn: async () => ({ ...(await api<WorkspaceInfo>(`/api/workspaces/${wsId}`)), ...(await api<{ invites: { id: string; email: string; role: string; expires_at: string }[] }>(`/api/workspaces/${wsId}/members`)) }), enabled: Boolean(wsId) });
  const [invite, setInvite] = React.useState({ email: "", role: "member" });
  const [deleteEmail, setDeleteEmail] = React.useState("");
  const [deleting, setDeleting] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (me) setName(me.display_name ?? "");
  }, [me]);
  React.useEffect(() => {
    if (!wsId && workspaces?.length) setWsId(workspaces.find((w) => w.type === "team")?.id ?? workspaces[0].id);
  }, [workspaces, wsId]);

  if (isLoading || !me) return <Skeleton className="h-96" />;

  const saveProfile = async () => {
    try {
      await patch("/api/account", { display_name: name });
      toast.success("Profile saved");
      invalidate("account");
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };
  const avatar = async (file: File) => {
    try {
      await uploadImage(file, "avatar");
      toast.success("Avatar updated");
      invalidate("account");
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };
  const changePassword = async () => {
    try {
      await post("/api/account", { action: "change_password", ...pw });
      toast.success("Password changed");
      setPw({ current: "", password: "", confirm: "" });
    } catch (e) {
      toast.error((e as Error).message);
    }
  };
  const action = async (a: string, ok: string) => {
    try {
      const res = await post<{ next?: string; message?: string }>("/api/account", { action: a });
      toast.success(res.message ?? ok);
      invalidate("account");
      if (res.next) {
        router.replace(res.next);
        router.refresh();
      }
    } catch (e) {
      toast.error((e as Error).message);
    }
  };
  /** SPEC §21.5 — immediate, confirmed by typing the signed-in e-mail. */
  const deleteAccount = async () => {
    setDeleting(true);
    try {
      const res = await post<{ next?: string }>("/api/account", { action: "delete_account", email: deleteEmail.trim() });
      toast.success("Your account and all of its data have been deleted");
      router.replace(res.next ?? "/");
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
      setDeleting(false);
    }
  };
  const setPref = async (k: string, v: boolean) => {
    await patch("/api/account", { notification_prefs: { [k]: v } });
    invalidate("account");
  };
  const sendInvite = async () => {
    try {
      await post(`/api/workspaces/${wsId}/invites`, invite);
      toast.success("Invitation sent");
      setInvite({ email: "", role: "member" });
      invalidate("workspace");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };
  const setRole = async (userId: string, role: string) => {
    await patch(`/api/workspaces/${wsId}/members/${userId}`, { role });
    invalidate("workspace");
  };
  const removeMember = async (userId: string) => {
    await del(`/api/workspaces/${wsId}/members/${userId}`);
    invalidate("workspace", "workspaces");
    router.refresh();
  };
  const renameWs = async (n: string) => {
    await patch(`/api/workspaces/${wsId}`, { name: n });
    invalidate("workspace", "workspaces");
    router.refresh();
  };
  const deleteWs = async () => {
    if (!confirm("Delete this team workspace and all of its assets?")) return;
    try {
      await del(`/api/workspaces/${wsId}`);
      setWsId("");
      invalidate("workspaces");
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const w = ws.data;
  const isOwner = w?.role === "owner";
  const isAdmin = w?.role === "owner" || w?.role === "admin";

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <Tabs defaultValue={sp.get("tab") ?? "profile"}>
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="workspace">Workspace</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="privacy">Data & privacy</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="mt-4">
          <Card className="max-w-xl">
            <CardHeader><CardTitle>Profile</CardTitle></CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <Avatar src={me.avatar_url} name={me.display_name ?? me.email} className="size-14 text-base" />
                <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => e.target.files?.[0] && avatar(e.target.files[0])} />
                <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>Change avatar</Button>
                <span className="text-muted-foreground text-xs">PNG/JPG/WebP, max 2 MB</span>
              </div>
              <div className="grid gap-2">
                <Label>Display name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
              </div>
              <div className="grid gap-2">
                <Label>E-mail</Label>
                <Input value={me.email} disabled />
                <p className="text-muted-foreground text-xs">E-mail change is coming later.</p>
              </div>
              <label className="flex items-center justify-between text-sm">
                Product updates (marketing e-mails)
                <Switch checked={me.marketing_consent} onCheckedChange={async (v) => { await patch("/api/account", { marketing_consent: v }); invalidate("account"); }} />
              </label>
              <Button className="w-fit" onClick={saveProfile}>Save</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="mt-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>Change password</CardTitle><CardDescription>At least 10 characters with a letter and a digit.</CardDescription></CardHeader>
              <CardContent className="flex flex-col gap-3">
                <Input type="password" placeholder="Current password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} />
                <Input type="password" placeholder="New password" value={pw.password} onChange={(e) => setPw({ ...pw, password: e.target.value })} />
                <Input type="password" placeholder="Repeat new password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} />
                <Button className="w-fit" onClick={changePassword} disabled={!pw.current || !pw.password}>Update password</Button>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Sessions</CardTitle><CardDescription>Sign out of every device, including this one.</CardDescription></CardHeader>
              <CardContent>
                <Button variant="outline" onClick={() => action("sign_out_everywhere", "Signed out everywhere")}>Sign out everywhere</Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="workspace" className="mt-4">
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <Label>Workspace</Label>
              <Select size="sm" className="w-64" value={wsId} onValueChange={setWsId} options={(workspaces ?? []).map((x) => ({ value: x.id, label: `${x.name} (${x.type})` }))} />
              <Button size="sm" variant="outline" onClick={() => router.push("/app/workspaces/new")}>New team workspace</Button>
            </div>
            {w && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">{w.name} <Badge variant="secondary">{w.type}</Badge> <Badge variant="outline">{w.role}</Badge></CardTitle>
                  <CardDescription>{w.type === "team" ? `${w.members.length} / ${w.seats} seats` : "Personal workspaces have a single member."}</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  {isOwner && w.type === "team" && (
                    <div className="flex gap-2">
                      <Input defaultValue={w.name} className="w-64" onBlur={(e) => e.target.value !== w.name && renameWs(e.target.value)} />
                    </div>
                  )}
                  <Table>
                    <THead><TR><TH>Member</TH><TH>Role</TH><TH>Joined</TH><TH /></TR></THead>
                    <TBody>
                      {w.members.map((m) => (
                        <TR key={m.user_id}>
                          <TD>{m.profiles?.display_name ?? m.profiles?.email}<span className="text-muted-foreground ml-2 text-xs">{m.profiles?.email}</span></TD>
                          <TD>
                            {isAdmin && m.user_id !== w.owner_id ? (
                              <Select size="sm" className="w-28" value={m.role} onValueChange={(r) => setRole(m.user_id, r)} options={["admin", "member", "viewer"].map((r) => ({ value: r, label: r }))} />
                            ) : (
                              <Badge variant="outline">{m.role}</Badge>
                            )}
                          </TD>
                          <TD className="text-muted-foreground text-xs">{formatDateTime(m.joined_at)}</TD>
                          <TD className="text-right">
                            {m.user_id !== w.owner_id && (isAdmin || m.user_id === me.id) && w.type === "team" && (
                              <Button size="sm" variant="ghost" onClick={() => removeMember(m.user_id)}>{m.user_id === me.id ? "Leave" : "Remove"}</Button>
                            )}
                          </TD>
                        </TR>
                      ))}
                    </TBody>
                  </Table>
                  {isAdmin && w.type === "team" && (
                    <div className="flex flex-wrap items-end gap-2 rounded-md border p-3">
                      <div className="grid gap-1"><Label>Invite by e-mail</Label><Input className="h-8 w-64" value={invite.email} onChange={(e) => setInvite({ ...invite, email: e.target.value })} placeholder="teammate@studio.com" /></div>
                      <Select size="sm" className="w-28" value={invite.role} onValueChange={(r) => setInvite({ ...invite, role: r })} options={["admin", "member", "viewer"].map((r) => ({ value: r, label: r }))} />
                      <Button size="sm" onClick={sendInvite} disabled={!invite.email}>Send invite</Button>
                      {w.invites?.length ? (
                        <ul className="text-muted-foreground w-full text-xs">
                          {w.invites.map((i) => (
                            <li key={i.id} className="flex items-center justify-between py-0.5">
                              <span>{i.email} · {i.role} · expires {formatDateTime(i.expires_at)}</span>
                              <Button size="sm" variant="ghost" onClick={async () => { await del(`/api/workspaces/${wsId}/invites/${i.id}`); invalidate("workspace"); }}>Revoke</Button>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  )}
                  {isOwner && w.type === "team" && (
                    <div className="border-destructive/40 rounded-md border p-3">
                      <div className="mb-2 text-sm font-medium">Danger zone</div>
                      <Button variant="destructive" size="sm" onClick={deleteWs}>Delete workspace</Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="notifications" className="mt-4">
          <Card className="max-w-xl">
            <CardHeader><CardTitle>E-mail notifications</CardTitle></CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm">
              <label className="flex items-center justify-between">Job completed <Switch checked={Boolean(me.notification_prefs?.job_completed)} onCheckedChange={(v) => setPref("job_completed", v)} /></label>
              <label className="flex items-center justify-between">Assets expiring soon <Switch checked={me.notification_prefs?.assets_expiring !== false} onCheckedChange={(v) => setPref("assets_expiring", v)} /></label>
              <label className="flex items-center justify-between">Marketing <Switch checked={me.marketing_consent} onCheckedChange={async (v) => { await patch("/api/account", { marketing_consent: v }); invalidate("account"); }} /></label>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="privacy" className="mt-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>Your data</CardTitle><CardDescription>Export a ZIP with your profile, projects, asset metadata, ledger and file links (24 h).</CardDescription></CardHeader>
              <CardContent className="flex flex-col gap-2">
                <Button variant="outline" className="w-fit" onClick={() => action("request_export", "Export requested")}>Request data export</Button>
                <Button variant="outline" className="w-fit" onClick={openConsentManager}>Cookie settings</Button>
                <p className="text-muted-foreground text-xs">Accepted Terms version: {me.tos_version ?? "—"} (current {me.tos_current})</p>
              </CardContent>
            </Card>
            <Card className="border-destructive/40">
              <CardHeader><CardTitle>Delete account</CardTitle><CardDescription>Deletes your account, personal workspace and every file in it immediately. There is no grace period and nothing can be restored.</CardDescription></CardHeader>
              <CardContent className="flex flex-col gap-2">
                <Alert variant="destructive">
                  <AlertDescription>This cannot be undone. An active subscription is cancelled with the account.</AlertDescription>
                </Alert>
                <Label className="text-xs" htmlFor="delete-confirm-email">
                  Type <span className="font-medium">{me.email}</span> to confirm
                </Label>
                <Input
                  id="delete-confirm-email"
                  value={deleteEmail}
                  onChange={(e) => setDeleteEmail(e.target.value)}
                  placeholder={me.email}
                  autoComplete="off"
                  className="max-w-sm"
                />
                <Button
                  variant="destructive"
                  className="w-fit"
                  disabled={deleteEmail.trim().toLowerCase() !== me.email.toLowerCase() || deleting}
                  onClick={deleteAccount}
                >
                  {deleting ? "Deleting…" : "Delete my account permanently"}
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <React.Suspense>
      <SettingsInner />
    </React.Suspense>
  );
}
