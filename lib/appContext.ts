import "server-only";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getCurrentWorkspace, isWorkspaceReadOnly, type MemberRole, type Workspace } from "@/lib/workspace";
import { getBalance, type BalanceView } from "@/lib/credits/ledger";
import { planFor } from "@/lib/plans";
import { storage } from "@/lib/storage";
import { env } from "@/lib/env";
import type { Database } from "@/lib/supabase/database.types";

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export interface WorkspaceSummary {
  id: string;
  name: string;
  slug: string;
  type: Workspace["type"];
  plan: Workspace["plan"];
  subscription_status: Workspace["subscription_status"];
  role: MemberRole;
}

export interface AppContext {
  userId: string;
  profile: Profile;
  avatarUrl: string | null;
  workspaces: WorkspaceSummary[];
  workspace: Workspace;
  role: MemberRole;
  readOnly: boolean;
  balance: BalanceView;
  planPool: number;
  needsTos: boolean;
  isAdmin: boolean;
  tosVersion: string;
}

/** Everything the signed-in shell needs (SPEC §17.4). Redirects to /login when signed out. */
export async function getAppContext(): Promise<AppContext> {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const db = supabaseAdmin();
  const { data: profile } = await db.from("profiles").select("*").eq("id", user.id).maybeSingle();
  if (!profile) redirect("/login");
  if (profile.banned_at) redirect("/banned");

  const [{ workspace, role }, { data: memberships }] = await Promise.all([
    getCurrentWorkspace(user.id),
    db.from("workspace_members").select("role, workspaces(id, name, slug, type, plan, subscription_status)").eq("user_id", user.id),
  ]);
  const balance = await getBalance(workspace.id);
  const workspaces: WorkspaceSummary[] = (memberships ?? [])
    .filter((m) => m.workspaces)
    .map((m) => ({ ...(m.workspaces as Omit<WorkspaceSummary, "role">), role: m.role }))
    .sort((a, b) => (a.type === "personal" ? -1 : b.type === "personal" ? 1 : a.name.localeCompare(b.name)));

  return {
    userId: user.id,
    profile,
    avatarUrl: profile.avatar_key ? await storage().presignGet(profile.avatar_key, { inline: true, ttl: 3600 }) : null,
    workspaces,
    workspace,
    role,
    readOnly: isWorkspaceReadOnly(workspace),
    balance,
    planPool: planFor(workspace.plan).credits,
    needsTos: !profile.tos_accepted_at || profile.tos_version !== env.TOS_VERSION,
    isAdmin: profile.role === "admin",
    tosVersion: env.TOS_VERSION,
  };
}
