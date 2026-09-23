"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { CreditCardIcon, ExternalLinkIcon, SparklesIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, Badge, Card, CardContent, CardDescription, CardHeader, CardTitle, Progress, Skeleton, Table, TBody, TD, TH, THead, TR } from "@/components/ui/primitives";
import { post } from "@/lib/client/api";
import { useBillingSummary } from "@/hooks/use-data";
import { PLANS } from "@/lib/plans";
import { daysUntil, formatBytes, formatDateTime } from "@/lib/utils";

const KIND_LABELS: Record<string, string> = {
  subscription_grant: "Subscription credits",
  pack_purchase: "Credit pack",
  trial_purchase: "Trial",
  reservation: "Reserved",
  settlement: "Charged",
  release: "Released",
  refund: "Refund",
  admin_adjustment: "Adjustment",
  expiry: "Expired",
};

function BillingInner() {
  const sp = useSearchParams();
  const router = useRouter();
  const [page, setPage] = React.useState(0);
  const { data, isLoading, refetch } = useBillingSummary(page);
  const [busy, setBusy] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (sp.get("status") === "success") {
      toast.success("Payment received — credits will appear within a few seconds.");
      const t = setTimeout(() => refetch(), 3000);
      router.replace("/app/billing");
      return () => clearTimeout(t);
    }
  }, [sp, refetch, router]);

  const checkout = async (kind: string) => {
    if (!data) return;
    setBusy(kind);
    try {
      const res = await post<{ url: string }>("/api/billing/checkout", { workspace_id: data.workspace.id, kind });
      window.location.href = res.url;
    } catch (e) {
      toast.error((e as Error).message);
      setBusy(null);
    }
  };
  const portal = async () => {
    if (!data) return;
    setBusy("portal");
    try {
      const res = await post<{ url: string }>("/api/billing/portal", { workspace_id: data.workspace.id });
      window.location.href = res.url;
    } catch (e) {
      toast.error((e as Error).message);
      setBusy(null);
    }
  };

  React.useEffect(() => {
    const buy = sp.get("buy");
    if (buy && data && data.billing_configured && data.role === "owner") void checkout(buy);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.workspace.id]);

  if (isLoading || !data) return <Skeleton className="h-96" />;
  const ws = data.workspace;
  const b = data.balance;
  const owner = data.role === "owner";
  const subscribed = ws.subscription_status === "active" || ws.subscription_status === "past_due";
  const resetDays = daysUntil(ws.current_period_end);
  const maxUsage = Math.max(1, ...data.usage_30d.map((u) => u.credits));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Billing</h1>
        <p className="text-muted-foreground text-sm">Workspace: {ws.name}. All payments happen on Stripe — no card details are stored here.</p>
      </div>
      {!data.billing_configured && (
        <Alert variant="warning">
          <AlertDescription>Billing is not configured on this environment yet (Stripe keys missing). Purchases are disabled.</AlertDescription>
        </Alert>
      )}
      {!owner && (
        <Alert variant="info">
          <AlertDescription>Only the workspace owner can change the plan or buy credits.</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Plan <Badge>{PLANS[ws.plan as keyof typeof PLANS]?.name ?? ws.plan}</Badge>
            </CardTitle>
            <CardDescription>
              {subscribed ? `Renews ${formatDateTime(ws.current_period_end)}${ws.cancel_at_period_end ? " (cancels at period end)" : ""}` : ws.plan === "trial" ? "Trial — one-time credits" : "No active subscription"}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {ws.subscription_status === "past_due" && <Badge variant="destructive">Payment failed</Badge>}
            {subscribed ? (
              <Button variant="outline" onClick={portal} disabled={!owner || busy === "portal" || !data.billing_configured}>
                <ExternalLinkIcon /> Manage subscription
              </Button>
            ) : (
              <>
                {ws.type === "personal" && (
                  <Button onClick={() => checkout("pro")} disabled={!owner || Boolean(busy) || !data.billing_configured}>
                    Upgrade to Pro — ${PLANS.pro.priceUsd}/mo
                  </Button>
                )}
                <Button variant={ws.type === "team" ? "default" : "outline"} onClick={() => checkout("studio")} disabled={!owner || Boolean(busy) || !data.billing_configured}>
                  {ws.type === "team" ? "Activate" : "Upgrade to"} Studio — ${PLANS.studio.priceUsd}/mo
                </Button>
              </>
            )}
            <div className="text-muted-foreground text-xs">
              Storage: {formatBytes(ws.storage_used_bytes)} / {formatBytes(ws.storage_quota_bytes)}
            </div>
            <Progress value={(ws.storage_used_bytes / Math.max(1, ws.storage_quota_bytes)) * 100} className="h-1.5" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Subscription credits</CardTitle>
            <CardDescription>{data.plan_pool ? `Resets in ${resetDays ?? "—"} days` : "Available with Pro or Studio"}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">
              {b.subscription_available} <span className="text-muted-foreground text-base">/ {data.plan_pool}</span>
            </div>
            <Progress value={data.plan_pool ? (b.subscription_available / data.plan_pool) * 100 : 0} className="mt-3" />
            <p className="text-muted-foreground mt-2 text-xs">Unused subscription credits lapse at each monthly renewal.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Usage credits</CardTitle>
            <CardDescription>Never expire</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">{b.purchased_available}</div>
            {b.trial_available > 0 && (
              <p className="mt-2 text-xs">
                <SparklesIcon className="mr-1 inline size-3" />
                {b.trial_available} trial credits · expire in {daysUntil(b.trial_expires_at) ?? "—"} days
              </p>
            )}
            {b.reserved > 0 && <p className="text-muted-foreground mt-1 text-xs">{b.reserved} reserved by running jobs</p>}
            <div className="mt-3 flex flex-wrap gap-2">
              {data.packs.map((p) => (
                <Button key={p.id} size="sm" variant="outline" onClick={() => checkout(p.id)} disabled={!owner || Boolean(busy) || !data.billing_configured}>
                  <CreditCardIcon /> {p.name}: {p.credits.toLocaleString()} for ${p.priceUsd}
                </Button>
              ))}
              {data.trial_available_to_buy && (
                <Button size="sm" onClick={() => checkout("trial")} disabled={!owner || Boolean(busy) || !data.billing_configured}>
                  Start trial — ${PLANS.trial.priceUsd} ({PLANS.trial.credits} credits)
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Usage — last 30 days</CardTitle>
        </CardHeader>
        <CardContent>
          {data.usage_30d.length ? (
            <div className="flex h-32 items-end gap-1">
              {data.usage_30d.map((u) => (
                <div key={u.day} className="bg-primary/70 flex-1 rounded-t" style={{ height: `${(u.credits / maxUsage) * 100}%` }} title={`${u.day}: ${u.credits} credits`} />
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">No usage yet.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Credit history</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <THead>
              <TR>
                <TH>Date</TH>
                <TH>Type</TH>
                <TH>Bucket</TH>
                <TH className="text-right">Credits</TH>
                <TH>Note</TH>
              </TR>
            </THead>
            <TBody>
              {data.ledger.map((l) => (
                <TR key={l.id}>
                  <TD className="text-muted-foreground text-xs">{formatDateTime(l.created_at)}</TD>
                  <TD>{KIND_LABELS[l.kind] ?? l.kind}</TD>
                  <TD className="text-muted-foreground text-xs">{l.bucket ?? "—"}</TD>
                  <TD className={`text-right font-mono ${l.delta < 0 ? "text-destructive" : "text-emerald-500"}`}>{l.delta > 0 ? "+" : ""}{l.delta}</TD>
                  <TD className="text-muted-foreground max-w-64 truncate text-xs">{l.description}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
          <div className="mt-3 flex items-center justify-between text-xs">
            <span className="text-muted-foreground">{data.ledger_total} entries</span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Previous</Button>
              <Button size="sm" variant="outline" disabled={(page + 1) * data.page_size >= data.ledger_total} onClick={() => setPage((p) => p + 1)}>Next</Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function BillingPage() {
  return (
    <React.Suspense>
      <BillingInner />
    </React.Suspense>
  );
}
