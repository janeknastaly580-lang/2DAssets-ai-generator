import type { Instrumentation } from "next";

/**
 * SPEC §25.4 — uncaught server errors (RSC render, Server Actions, middleware, Route Handlers that are
 * not wrapped in `handler()`, e.g. webhooks) → Google Cloud Error Reporting. Wrapped handlers report
 * their own 500s in `lib/api.ts: fail()`.
 */
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  const { reportError } = await import("@/lib/errorReporting");
  const header = (name: string) => {
    const v = request.headers[name];
    return Array.isArray(v) ? v[0] : v;
  };
  await reportError(err, {
    where: `${context.routeType} ${context.routePath}`,
    httpRequest: { method: request.method, url: request.path, userAgent: header("user-agent"), referrer: header("referer"), responseStatusCode: 500 },
  });
};
