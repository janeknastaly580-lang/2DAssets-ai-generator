import Link from "next/link";
import { BoxIcon, MusicIcon, ArrowRightIcon } from "lucide-react";
import { getAppContext } from "@/lib/appContext";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { withPreviewUrls } from "@/lib/assets";
import { Card, CardContent, CardHeader, CardTitle, Progress, EmptyState } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { AssetCard } from "@/components/app/asset-card";
import { ActiveJobs } from "@/components/app/active-jobs";
import { daysUntil, ACTIVE_JOB_STATUSES } from "@/lib/utils";
import type { AssetRow } from "@/hooks/use-data";

/** SPEC §17.4 Dashboard. */
export default async function DashboardPage() {
  const ctx = await getAppContext();
  const db = supabaseAdmin();
  const [{ data: assets }, { data: projects }, { count: activeCount }] = await Promise.all([
    db.from("assets").select("*").eq("workspace_id", ctx.workspace.id).is("deleted_at", null).order("created_at", { ascending: false }).limit(10),
    db.from("projects").select("id, name, slug, is_scratch, updated_at").eq("workspace_id", ctx.workspace.id).is("archived_at", null).order("updated_at", { ascending: false }).limit(6),
    db.from("jobs").select("id", { count: "exact", head: true }).eq("workspace_id", ctx.workspace.id).in("status", ACTIVE_JOB_STATUSES),
  ]);
  const recent = (await withPreviewUrls(assets ?? [])) as unknown as AssetRow[];
  const resetDays = daysUntil(ctx.workspace.current_period_end);
  const quick = [
    { href: "/app/generate/model_3d", label: "3D Model", icon: BoxIcon },
    { href: "/app/generate/audio_sfx", label: "Sound", icon: MusicIcon },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Welcome back{ctx.profile.display_name ? `, ${ctx.profile.display_name}` : ""}</h1>
        <p className="text-muted-foreground text-sm">Workspace: {ctx.workspace.name}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Quick generate</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-2">
            {quick.map((q) => (
              <Button key={q.href} asChild variant="outline" className="justify-start">
                <Link href={q.href}>
                  <q.icon /> {q.label}
                </Link>
              </Button>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Credits</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            {ctx.planPool > 0 ? (
              <>
                <div className="flex justify-between">
                  <span>Subscription credits</span>
                  <span className="font-medium">
                    {ctx.balance.subscription_available} / {ctx.planPool}
                  </span>
                </div>
                <Progress value={(ctx.balance.subscription_available / ctx.planPool) * 100} />
                <div className="text-muted-foreground text-xs">{resetDays != null ? `Resets in ${resetDays} days` : "Monthly reset"}</div>
              </>
            ) : (
              <div className="text-muted-foreground">No subscription — credits come from packs or the trial.</div>
            )}
            <div className="flex justify-between">
              <span>Usage credits</span>
              <span className="font-medium">{ctx.balance.purchased_available}</span>
            </div>
            {ctx.balance.trial_available > 0 && (
              <div className="text-muted-foreground text-xs">
                {ctx.balance.trial_available} trial credits · expire in {daysUntil(ctx.balance.trial_expires_at) ?? "—"} days
              </div>
            )}
            <Button asChild size="sm" variant="secondary" className="mt-1 w-fit">
              <Link href="/app/billing">
                Billing <ArrowRightIcon />
              </Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Active jobs {activeCount ? `(${activeCount})` : ""}</CardTitle>
          </CardHeader>
          <CardContent>
            <ActiveJobs workspaceId={ctx.workspace.id} />
          </CardContent>
        </Card>
      </div>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">Recent assets</h2>
          <Link href="/app/library" className="text-primary text-sm hover:underline">
            Open library
          </Link>
        </div>
        {recent.length ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {recent.map((a) => (
              <AssetCard key={a.id} asset={a} />
            ))}
          </div>
        ) : (
          <EmptyState title="No assets yet" description="Generate your first sprite, model or sound." action={<Button asChild><Link href="/app/generate/image">Generate an image</Link></Button>} />
        )}
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">Projects</h2>
          <Link href="/app/projects" className="text-primary text-sm hover:underline">
            All projects
          </Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(projects ?? []).map((p) => (
            <Link key={p.id} href={`/app/projects/${p.id}`} className="bg-card hover:border-primary/50 rounded-lg border p-4 text-sm">
              <div className="font-medium">{p.name}</div>
              <div className="text-muted-foreground text-xs">{p.is_scratch ? "Scratch — no style guide" : "Project"}</div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
