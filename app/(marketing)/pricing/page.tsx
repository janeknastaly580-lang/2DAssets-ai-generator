import Link from "next/link";
import { CheckIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/primitives";
import { CREDIT_PACKS, PLANS } from "@/lib/plans";
import { formatBytes } from "@/lib/utils";

export const metadata = { title: "Pricing" };

const ROWS: { label: string; get: (p: (typeof PLANS)["pro"]) => React.ReactNode }[] = [
  { label: "Credits", get: (p) => (p.credits ? `${p.credits}${p.billing === "monthly" ? " / month" : p.billing === "one_time" ? " (30 days)" : ""}` : "—") },
  { label: "Unused subscription credits", get: (p) => (p.billing === "monthly" ? "Reset monthly" : "—") },
  { label: "Concurrent jobs", get: (p) => p.concurrency },
  { label: "Storage", get: (p) => formatBytes(p.storageBytes) },
  { label: "File retention", get: (p) => (p.retentionDays ? `${p.retentionDays} days` : "While subscribed + 90 days") },
  { label: "Input photos per 3D job", get: (p) => (p.credits ? String(p.maxInputImages) : "—") },
  { label: "4K 3D textures", get: (p) => (p.textures4k ? <CheckIcon className="text-primary mx-auto size-4" /> : <XIcon className="text-muted-foreground mx-auto size-4" />) },
  { label: "Team workspaces", get: (p) => (p.teamWorkspaces ? `${p.seats} seats` : <XIcon className="text-muted-foreground mx-auto size-4" />) },
  { label: "Credit packs", get: () => <CheckIcon className="text-primary mx-auto size-4" /> },
];

export default function PricingPage() {
  const tiers = [PLANS.none, PLANS.trial, PLANS.pro, PLANS.studio];
  return (
    <div className="mx-auto max-w-6xl px-4 py-16">
      <h1 className="text-center text-4xl font-bold">Pricing</h1>
      <p className="text-muted-foreground mx-auto mt-4 max-w-xl text-center">
        1 credit ≈ $0.01 of AI provider cost. Prices are net; VAT is added at checkout by Stripe. All payments are handled by Stripe — we never see your card.
      </p>

      <div className="mt-10 grid gap-4 md:grid-cols-4">
        {tiers.map((p) => (
          <Card key={p.id} className={p.id === "pro" ? "border-primary" : ""}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{p.name}</CardTitle>
                {p.id === "pro" && <Badge>Popular</Badge>}
              </div>
              <CardDescription>
                {p.priceUsd === null ? "Free" : `$${p.priceUsd}${p.billing === "monthly" ? " / month" : " once"}`}
              </CardDescription>
            </CardHeader>
            <CardContent className="mt-auto">
              <Button asChild className="w-full" variant={p.id === "pro" ? "default" : "outline"}>
                <Link href={p.id === "none" ? "/signup" : `/app/billing?buy=${p.id}`}>{p.id === "none" ? "Create account" : p.id === "trial" ? "Start trial" : `Choose ${p.name}`}</Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-10 overflow-x-auto rounded-xl border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40">
            <tr>
              <th className="p-3 text-left font-medium">Feature</th>
              {tiers.map((p) => (
                <th key={p.id} className="p-3 text-center font-medium">{p.name}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {ROWS.map((r) => (
              <tr key={r.label}>
                <td className="p-3">{r.label}</td>
                {tiers.map((p) => (
                  <td key={p.id} className="p-3 text-center">{r.get(p)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="mt-14 text-center text-2xl font-semibold">Credit packs</h2>
      <p className="text-muted-foreground mt-2 text-center text-sm">Usage credits never expire. Available on every plan.</p>
      <div className="mx-auto mt-6 grid max-w-2xl gap-4 md:grid-cols-2">
        {CREDIT_PACKS.map((pack) => (
          <Card key={pack.id}>
            <CardHeader>
              <CardTitle>{pack.name}</CardTitle>
              <CardDescription>{pack.credits.toLocaleString()} credits</CardDescription>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              <span className="text-2xl font-semibold">
                ${pack.priceUsd}
                {pack.placeholder && <span className="text-muted-foreground ml-1 text-xs">(indicative)</span>}
              </span>
              <Button asChild variant="outline">
                <Link href={`/app/billing?buy=${pack.id}`}>Buy</Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <h2 className="mt-14 text-center text-2xl font-semibold">Credits FAQ</h2>
      <div className="mx-auto mt-6 max-w-3xl divide-y rounded-xl border">
        {[
          ["How are credits consumed?", "Trial credits first (they expire soonest), then subscription credits (reset monthly), then usage credits from packs."],
          ["What happens to unused subscription credits?", "They lapse when the next invoice is paid; the pool resets to 1000 (Pro) or 3200 (Studio)."],
          ["Are credits charged if a generation fails?", "No. Credits are reserved when a job starts and released if it fails or is rejected by the content policy."],
          ["Can I buy the trial twice?", `The $${PLANS.trial.priceUsd} trial is available once per account.`],
        ].map(([q, a]) => (
          <details key={q} className="p-4">
            <summary className="cursor-pointer list-none font-medium">{q}</summary>
            <p className="text-muted-foreground mt-2 text-sm">{a}</p>
          </details>
        ))}
      </div>
    </div>
  );
}
