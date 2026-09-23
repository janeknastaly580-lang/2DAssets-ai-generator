import { AppShell } from "@/components/app/app-shell";
import { getAppContext } from "@/lib/appContext";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getAppContext();
  return (
    <AppShell
      ctx={{
        profile: ctx.profile,
        avatarUrl: ctx.avatarUrl,
        workspaces: ctx.workspaces,
        balance: ctx.balance,
        planPool: ctx.planPool,
        isAdmin: ctx.isAdmin,
        role: ctx.role,
        readOnly: ctx.readOnly,
        needsTos: ctx.needsTos,
        tosVersion: ctx.tosVersion,
        workspace: {
          id: ctx.workspace.id,
          name: ctx.workspace.name,
          type: ctx.workspace.type,
          plan: ctx.workspace.plan,
          subscription_status: ctx.workspace.subscription_status,
          grace_until: ctx.workspace.grace_until,
        },
      }}
    >
      {children}
    </AppShell>
  );
}
