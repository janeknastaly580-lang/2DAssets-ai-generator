import "server-only";
import { after } from "next/server";
import { env, integrations } from "@/lib/env";
import { sanitizeUrl } from "@/lib/analytics";

/**
 * SPEC §25.4 — Google Cloud Error Reporting (the web/server counterpart of Firebase Crashlytics, which
 * has no web SDK). Events go to `projects.events.report` with an API key restricted to that API.
 * Without GCP_PROJECT_ID + GCP_ERROR_REPORTING_API_KEY every call is a no-op. Never throws.
 */
export interface ErrorContext {
  /** `server` = Route Handlers, RSC, pipelines, webhooks; `browser` = reports from /api/client-errors. */
  source?: "server" | "browser";
  /** Stable label used when the error has no parsable stack frame, e.g. "pipeline model_3d". */
  where?: string;
  httpRequest?: { method?: string; url?: string; userAgent?: string; referrer?: string; responseStatusCode?: number };
  /** Supabase user id (pseudonymous) — Error Reporting counts affected users with it. */
  userId?: string;
}

const MAX_MESSAGE = 16_000;

function version(): string {
  const sha = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7);
  return `${process.env.VERCEL_ENV ?? "local"}${sha ? `-${sha}` : ""}`;
}

/** Error Reporting groups JS errors by the `err.stack` text (V8 format: "Error: msg\n    at fn (file:1:2)"). */
export function errorMessage(err: unknown): string {
  if (err instanceof Error) {
    const head = `${err.name}: ${err.message}`;
    return err.stack?.startsWith(head) ? err.stack : `${head}\n${err.stack ?? ""}`.trimEnd();
  }
  if (typeof err === "string") return `Error: ${err}`;
  try {
    return `Error: ${JSON.stringify(err)}`;
  } catch {
    return `Error: ${String(err)}`;
  }
}

/** First stack frame (V8 "at fn (file:l:c)" or Firefox/Safari "fn@file:l:c") — required when the stack is not parsable. */
export function reportLocation(message: string, where?: string) {
  const v8 = message.match(/\n\s+at (?:(.+?) \()?(.+?):(\d+):\d+\)?\n?/);
  const gecko = v8 ? null : message.match(/^(.*?)@(.+?):(\d+):\d+$/m);
  const m = v8 ?? gecko;
  if (m) return { filePath: m[2], lineNumber: Number(m[3]), functionName: m[1] || where || "<anonymous>" };
  return { filePath: where ?? "unknown", lineNumber: 0, functionName: where ?? "unknown" };
}

function cleanUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    return sanitizeUrl(new URL(url, env.APP_URL).href);
  } catch {
    return undefined;
  }
}

export async function reportError(err: unknown, ctx: ErrorContext = {}): Promise<void> {
  if (!integrations.errorReporting) return;
  try {
    const message = errorMessage(err).slice(0, MAX_MESSAGE);
    const req = ctx.httpRequest;
    const body = {
      eventTime: new Date().toISOString(),
      serviceContext: { service: `veyraflow-${ctx.source ?? "server"}`, version: version() },
      message,
      context: {
        httpRequest: req
          ? { method: req.method, url: cleanUrl(req.url), userAgent: req.userAgent?.slice(0, 500), referrer: cleanUrl(req.referrer), responseStatusCode: req.responseStatusCode }
          : undefined,
        user: ctx.userId,
        reportLocation: reportLocation(message, ctx.where),
      },
    };
    const res = await fetch(
      `https://clouderrorreporting.googleapis.com/v1beta1/projects/${encodeURIComponent(env.GCP_PROJECT_ID)}/events:report?key=${encodeURIComponent(env.GCP_ERROR_REPORTING_API_KEY)}`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(4000) },
    );
    if (!res.ok) console.warn(`[error-reporting] HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  } catch (e) {
    console.warn("[error-reporting] failed to report", (e as Error).message);
  }
}

/** Fire-and-forget inside a request: runs after the response is sent (falls back to a detached promise). */
export function reportErrorLater(err: unknown, ctx: ErrorContext = {}) {
  if (!integrations.errorReporting) return;
  try {
    after(() => reportError(err, ctx));
  } catch {
    void reportError(err, ctx);
  }
}
