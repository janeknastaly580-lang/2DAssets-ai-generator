import * as React from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { DownloadIcon, SparklesIcon } from "lucide-react";
import { Logo } from "@/components/logo";
import { AssetPreview } from "@/components/preview/asset-preview";
import { Badge } from "@/components/ui/primitives";
import { getSharePayload } from "@/lib/sharePublic";
import { ASSET_TYPE_LABELS, formatBytes, formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Shared asset", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** SPEC §18 — public share page (noindex), preview + optional download. */
export default async function SharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const payload = await getSharePayload(token, { countView: true });
  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex h-14 items-center justify-between border-b px-4">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <Logo className="size-6" /> Veyraflow
        </Link>
        <Link href="/ai-disclosure" className="text-muted-foreground inline-flex items-center gap-1 text-xs">
          <SparklesIcon className="size-3" /> Generated with AI
        </Link>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        {!payload ? (
          <div className="py-24 text-center">
            <h1 className="text-2xl font-semibold">This link is no longer available</h1>
            <p className="text-muted-foreground mt-2 text-sm">It may have expired or been revoked.</p>
          </div>
        ) : payload.kind === "asset" ? (
          <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
            <div>
              <h1 className="mb-1 text-2xl font-semibold">{payload.asset.name}</h1>
              <div className="text-muted-foreground mb-4 text-sm">
                {ASSET_TYPE_LABELS[payload.asset.type]} · {formatDate(payload.asset.created_at)}
              </div>
              <div className="min-h-80">
                <AssetPreview asset={payload.asset} files={payload.preview_files} />
              </div>
              {payload.asset.prompt && (
                <div className="mt-4 rounded-lg border p-3 text-sm">
                  <div className="text-muted-foreground mb-1 text-xs">Prompt</div>
                  {payload.asset.prompt}
                </div>
              )}
            </div>
            <aside className="flex flex-col gap-4">
              {payload.allow_download && payload.downloads.length > 0 && (
                <div className="rounded-lg border p-4">
                  <h2 className="mb-2 font-medium">Download</h2>
                  <ul className="divide-y text-sm">
                    {payload.downloads.map((d) => (
                      <li key={d.id} className="flex items-center gap-2 py-1.5">
                        <Badge variant="outline" className="uppercase">{d.format}</Badge>
                        <span className="flex-1 truncate">{d.variant ?? d.format}</span>
                        <span className="text-muted-foreground text-xs">{formatBytes(d.size_bytes)}</span>
                        <a href={d.url} className="text-primary" aria-label="Download"><DownloadIcon className="size-4" /></a>
                      </li>
                    ))}
                  </ul>
                  <p className="text-muted-foreground mt-2 text-xs">Links expire after 15 minutes — reload for fresh ones.</p>
                </div>
              )}
              <dl className="grid grid-cols-[100px_1fr] gap-y-1 rounded-lg border p-4 text-sm">
                {Object.entries(payload.asset.metadata).map(([k, v]) => (
                  <React.Fragment key={k}>
                    <dt className="text-muted-foreground capitalize">{k.replace(/_/g, " ")}</dt>
                    <dd className="truncate">{Array.isArray(v) ? (typeof v[0] === "string" && (v[0] as string).startsWith("#") ? <span className="flex flex-wrap gap-0.5">{(v as string[]).map((c) => <span key={c} className="size-3.5 rounded-sm border" style={{ background: c }} />)}</span> : `${v.length} items`) : String(v)}</dd>
                  </React.Fragment>
                ))}
              </dl>
            </aside>
          </div>
        ) : (
          <div>
            <h1 className="text-2xl font-semibold">{payload.project.name}</h1>
            {payload.project.description && <p className="text-muted-foreground mt-1 text-sm">{payload.project.description}</p>}
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {payload.assets.map((a) => (
                <div key={a.id} className="rounded-lg border p-2">
                  <div className="checkerboard flex aspect-square items-center justify-center overflow-hidden rounded">
                    {a.preview_url ? <img src={a.animated_preview_url ?? a.preview_url} alt={a.name} className="size-full object-contain" /> : <span className="text-muted-foreground text-xs">{ASSET_TYPE_LABELS[a.type]}</span>}
                  </div>
                  <div className="mt-1 truncate text-sm">{a.name}</div>
                  <div className="text-muted-foreground text-[11px]">{ASSET_TYPE_LABELS[a.type]}</div>
                </div>
              ))}
              {!payload.assets.length && <p className="text-muted-foreground text-sm">This project has no assets yet.</p>}
            </div>
          </div>
        )}
      </main>
      <footer className="text-muted-foreground border-t px-4 py-3 text-center text-xs">© {new Date().getFullYear()} Veyraflow · Assets are generated with AI</footer>
    </div>
  );
}
