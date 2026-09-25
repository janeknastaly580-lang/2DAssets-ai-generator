"use client";

import * as React from "react";
import { Sidebar, type SidebarContext } from "./sidebar";
import { Topbar } from "./topbar";
import { TosModal } from "./tos-modal";
import { SiteFooter } from "@/components/marketing/site-footer";
import { Alert, AlertDescription } from "@/components/ui/primitives";
import Link from "next/link";
import { PLANS } from "@/lib/plans";

export interface ShellProps {
  ctx: SidebarContext & {
    readOnly: boolean;
    needsTos: boolean;
    tosVersion: string;
    workspace: { id: string; name: string; type: string; plan: string; subscription_status: string; grace_until: string | null };
  };
  children: React.ReactNode;
}

/** SPEC §17.4 — app layout with sidebar, topbar, banners (past_due, read-only, retention) and ToS modal. */
export function AppShell({ ctx, children }: ShellProps) {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="flex h-screen overflow-hidden">
      <div className={`fixed inset-y-0 left-0 z-40 transition-transform md:static md:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}>
        <Sidebar ctx={ctx} />
      </div>
      {open && <div className="fixed inset-0 z-30 bg-black/50 md:hidden" onClick={() => setOpen(false)} />}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Topbar workspaceId={ctx.workspace.id} onMenu={() => setOpen(true)} />
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-7xl p-4 md:p-6">
            {ctx.workspace.subscription_status === "past_due" && (
              <Alert variant="warning" className="mb-4">
                <AlertDescription>
                  Your last payment failed. <Link href="/app/billing" className="underline">Update your payment method</Link> to keep generating.
                </AlertDescription>
              </Alert>
            )}
            {ctx.readOnly && (
              <Alert variant="warning" className="mb-4">
                <AlertDescription>
                  This team workspace is read-only until a Studio subscription is active. <Link href="/app/billing" className="underline">Activate Studio</Link>
                </AlertDescription>
              </Alert>
            )}
            {ctx.workspace.plan === "none" && ctx.workspace.type === "personal" && (
              <Alert variant="info" className="mb-4">
                <AlertDescription>
                  Free workspaces keep files for 30 days. <Link href="/app/billing" className="underline">Start the ${PLANS.trial.priceUsd} trial or subscribe</Link> to keep them longer.
                </AlertDescription>
              </Alert>
            )}
            {children}
          </div>
          <SiteFooter compact />
        </main>
      </div>
      {ctx.needsTos && <TosModal version={ctx.tosVersion} />}
    </div>
  );
}
