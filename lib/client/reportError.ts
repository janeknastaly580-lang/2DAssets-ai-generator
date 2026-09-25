"use client";

import { ApiClientError } from "@/lib/client/api";

/**
 * SPEC §25.4 — browser errors → POST /api/client-errors → Google Cloud Error Reporting.
 * No cookies and no third-party request from the browser, so it does not depend on cookie consent.
 */
export type ClientErrorKind = "error" | "unhandledrejection" | "boundary" | "global-boundary";

const MAX_PER_PAGE = 10;
const sent = new Set<string>();

/** Noise that is not our bug: extensions, cross-origin "Script error.", aborted fetches, expected 4xx API errors. */
export function shouldIgnore(err: unknown, filename?: string): boolean {
  if (err instanceof ApiClientError) return err.status < 500;
  const e = err instanceof Error ? err : null;
  const message = e?.message ?? String(err ?? "");
  if (!e && /^Script error\.?$/.test(message)) return true;
  if (e?.name === "AbortError") return true;
  if (/ResizeObserver loop/.test(message)) return true;
  if (/-extension:\/\//.test(`${filename ?? ""}\n${e?.stack ?? ""}`)) return true;
  return false;
}

export function reportClientError(err: unknown, kind: ClientErrorKind) {
  try {
    const e = err instanceof Error ? err : new Error(typeof err === "string" ? err : JSON.stringify(err));
    const key = `${e.name}|${e.message}|${e.stack?.split("\n")[1] ?? ""}`;
    if (sent.has(key) || sent.size >= MAX_PER_PAGE) return;
    sent.add(key);
    void fetch("/api/client-errors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      keepalive: true,
      body: JSON.stringify({ kind, name: e.name.slice(0, 100), message: e.message.slice(0, 1000), stack: e.stack?.slice(0, 8000), url: location.href.slice(0, 2000) }),
    }).catch(() => undefined);
  } catch {
    // reporting must never break the page
  }
}
