"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { readConsent, type Consent } from "@/components/cookie-banner";
import { GA_ID, disableAnalytics, enableAnalytics, trackPageView } from "@/lib/analytics";

/** SPEC §21.6 — starts GA4 once analytics consent exists and reports page views on client-side navigation. */
export function Analytics() {
  const pathname = usePathname();

  React.useEffect(() => {
    if (!GA_ID) return;
    if (readConsent()?.analytics) enableAnalytics();
    const onConsent = (e: Event) => ((e as CustomEvent<Consent>).detail.analytics ? enableAnalytics() : disableAnalytics());
    window.addEventListener("vf:consent", onConsent);
    return () => window.removeEventListener("vf:consent", onConsent);
  }, []);

  React.useEffect(() => {
    // the new page's <title> is applied right after the route commits
    const t = setTimeout(trackPageView, 50);
    return () => clearTimeout(t);
  }, [pathname]);

  return null;
}
