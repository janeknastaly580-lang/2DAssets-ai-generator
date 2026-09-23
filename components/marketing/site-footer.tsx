"use client";

import Link from "next/link";
import { SparklesIcon } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { openConsentManager } from "@/components/cookie-banner";

/** SPEC §21.1 — footer: Product / Legal / Company / Social (hidden until URLs exist). */
export function SiteFooter({ compact = false }: { compact?: boolean }) {
  const year = new Date().getFullYear();
  if (compact) {
    return (
      <footer className="text-muted-foreground flex flex-wrap items-center justify-between gap-2 border-t px-4 py-3 text-xs">
        <span>© {year} Veyraflow. All rights reserved.</span>
        <div className="flex flex-wrap items-center gap-3">
          <Link href="/terms" className="hover:text-foreground">Terms</Link>
          <Link href="/privacy" className="hover:text-foreground">Privacy</Link>
          <Link href="/cookies" className="hover:text-foreground">Cookies</Link>
          <button onClick={openConsentManager} className="hover:text-foreground cursor-pointer">Cookie settings</button>
          <Link href="/ai-disclosure" className="hover:text-foreground inline-flex items-center gap-1">
            <SparklesIcon className="size-3" /> Assets are generated with AI
          </Link>
        </div>
      </footer>
    );
  }
  return (
    <footer className="border-t">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 md:grid-cols-4">
        <div>
          <h4 className="mb-3 text-sm font-semibold">Product</h4>
          <ul className="text-muted-foreground space-y-2 text-sm">
            <li><Link href="/pricing" className="hover:text-foreground">Pricing</Link></li>
            <li><Link href="/app/generate/image" className="hover:text-foreground">Generate</Link></li>
            <li><span className="opacity-60">Changelog (coming soon)</span></li>
            <li><span className="opacity-60">Status (coming soon)</span></li>
          </ul>
        </div>
        <div>
          <h4 className="mb-3 text-sm font-semibold">Legal</h4>
          <ul className="text-muted-foreground space-y-2 text-sm">
            <li><Link href="/terms" className="hover:text-foreground">Terms of Service</Link></li>
            <li><Link href="/privacy" className="hover:text-foreground">Privacy Policy</Link></li>
            <li><Link href="/cookies" className="hover:text-foreground">Cookie Policy</Link></li>
            <li><Link href="/ai-disclosure" className="hover:text-foreground">AI Disclosure</Link></li>
            <li><Link href="/impressum" className="hover:text-foreground">Impressum / Company details</Link></li>
            <li><button onClick={openConsentManager} className="hover:text-foreground cursor-pointer">Cookie settings</button></li>
          </ul>
        </div>
        <div>
          <h4 className="mb-3 text-sm font-semibold">Company</h4>
          <ul className="text-muted-foreground space-y-2 text-sm">
            <li><Link href="/contact" className="hover:text-foreground">Contact</Link></li>
            <li><a href="mailto:support@veyraflow.eu" className="hover:text-foreground">support@veyraflow.eu</a></li>
            <li className="opacity-60">Operator name and address — see Impressum (placeholder)</li>
          </ul>
        </div>
        <div>
          <h4 className="mb-3 text-sm font-semibold">Social</h4>
          <ul className="text-muted-foreground space-y-2 text-sm">
            <li className="opacity-60">Coming soon</li>
          </ul>
        </div>
      </div>
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 border-t px-4 py-4 text-xs text-muted-foreground">
        <span>© {year} Veyraflow. All rights reserved.</span>
        <div className="flex items-center gap-3">
          <Link href="/ai-disclosure" className="hover:text-foreground inline-flex items-center gap-1 rounded-full border px-2 py-1">
            <SparklesIcon className="size-3" /> Assets are generated with AI
          </Link>
          <ThemeToggle />
        </div>
      </div>
    </footer>
  );
}
