"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Switch } from "@/components/ui/overlays";
import { Label } from "@/components/ui/primitives";

/** SPEC §21.3 — consent stored in `vf_consent` (12 months); most private choice by default. */
export interface Consent {
  v: 1;
  necessary: true;
  analytics: boolean;
  marketing: boolean;
  ts: number;
}

const COOKIE = "vf_consent";

export function readConsent(): Consent | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(new RegExp(`(?:^|; )${COOKIE}=([^;]*)`));
  if (!m) return null;
  try {
    return JSON.parse(decodeURIComponent(m[1])) as Consent;
  } catch {
    return null;
  }
}

export function writeConsent(c: Omit<Consent, "v" | "necessary" | "ts">) {
  const value: Consent = { v: 1, necessary: true, analytics: c.analytics, marketing: c.marketing, ts: Date.now() };
  const secure = location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${COOKIE}=${encodeURIComponent(JSON.stringify(value))}; Max-Age=${60 * 60 * 24 * 365}; Path=/; SameSite=Lax${secure}`;
  window.dispatchEvent(new CustomEvent("vf:consent", { detail: value }));
  // persist for signed-in users (best-effort)
  fetch("/api/account", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "cookie_consent", consent: { analytics: c.analytics, marketing: c.marketing } }) }).catch(() => undefined);
  return value;
}

export function openConsentManager() {
  window.dispatchEvent(new CustomEvent("vf:consent-open"));
}

export function CookieBanner() {
  const [visible, setVisible] = React.useState(false);
  const [manager, setManager] = React.useState(false);
  const [analytics, setAnalytics] = React.useState(false);
  const [marketing, setMarketing] = React.useState(false);

  React.useEffect(() => {
    const c = readConsent();
    if (!c) setVisible(true);
    else {
      setAnalytics(c.analytics);
      setMarketing(c.marketing);
    }
    const open = () => {
      const cur = readConsent();
      setAnalytics(cur?.analytics ?? false);
      setMarketing(cur?.marketing ?? false);
      setManager(true);
    };
    window.addEventListener("vf:consent-open", open);
    return () => window.removeEventListener("vf:consent-open", open);
  }, []);

  const save = (a: boolean, m: boolean) => {
    writeConsent({ analytics: a, marketing: m });
    setVisible(false);
    setManager(false);
  };

  return (
    <>
      {visible && (
        <div role="dialog" aria-label="Cookie consent" className="bg-card fixed inset-x-4 bottom-4 z-50 mx-auto max-w-3xl rounded-xl border p-4 shadow-lg md:inset-x-auto md:right-4 md:left-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <p className="text-sm">
              We use necessary cookies to run Veyraflow. Analytics cookies (Google Analytics) are optional and only set with your consent.{" "}
              <a href="/cookies" className="underline">
                Cookie Policy
              </a>
            </p>
            <div className="flex shrink-0 gap-2">
              <Button variant="outline" size="sm" onClick={() => setManager(true)}>
                Customize
              </Button>
              <Button variant="secondary" size="sm" onClick={() => save(false, false)}>
                Necessary only
              </Button>
              <Button size="sm" onClick={() => save(true, true)}>
                Accept all
              </Button>
            </div>
          </div>
        </div>
      )}
      <Dialog open={manager} onOpenChange={setManager}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>Cookie settings</DialogTitle>
            <DialogDescription>Choose which optional cookies Veyraflow may use. Necessary cookies (session, workspace, consent) are always on.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <Label>Necessary</Label>
              <Switch checked disabled />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>Analytics</Label>
                <p className="text-muted-foreground text-xs">Google Analytics usage statistics — pages visited and features used (loaded only after consent).</p>
              </div>
              <Switch checked={analytics} onCheckedChange={setAnalytics} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>Marketing</Label>
                <p className="text-muted-foreground text-xs">Not used yet.</p>
              </div>
              <Switch checked={marketing} onCheckedChange={setMarketing} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => save(false, false)}>
              Necessary only
            </Button>
            <Button onClick={() => save(analytics, marketing)}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
