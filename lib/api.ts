import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { ZodError, type ZodType } from "zod";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin, ConfigError } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import { reportErrorLater } from "@/lib/errorReporting";
import type { Database } from "@/lib/supabase/database.types";

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];

/** SPEC §16 — uniform JSON envelope. */
export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 400,
    public details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ ok: true, data }, init);
}

export function fail(err: unknown, req?: NextRequest) {
  if (err instanceof ApiError) {
    return NextResponse.json(
      { ok: false, error: { code: err.code, message: err.message, details: err.details } },
      { status: err.status },
    );
  }
  if (err instanceof ZodError) {
    return NextResponse.json(
      { ok: false, error: { code: "validation_error", message: "Invalid input", details: err.issues } },
      { status: 400 },
    );
  }
  if (err instanceof ConfigError) {
    return NextResponse.json({ ok: false, error: { code: "not_configured", message: err.message } }, { status: 503 });
  }
  console.error("[api] unhandled error", err);
  reportErrorLater(err, {
    where: req ? `api ${req.method} ${req.nextUrl.pathname}` : "api",
    httpRequest: req && { method: req.method, url: req.url, userAgent: req.headers.get("user-agent") ?? undefined, referrer: req.headers.get("referer") ?? undefined, responseStatusCode: 500 },
  });
  const message = env.IS_DEV && err instanceof Error ? err.message : "Something went wrong";
  return NextResponse.json({ ok: false, error: { code: "internal_error", message } }, { status: 500 });
}

/** Wraps a Route Handler so thrown errors become JSON envelopes. */
export function handler<Ctx>(fn: (req: NextRequest, ctx: Ctx) => Promise<Response>) {
  return async (req: NextRequest, ctx: Ctx) => {
    try {
      return await fn(req, ctx);
    } catch (e) {
      return fail(e, req);
    }
  };
}

export async function parseJson<T>(req: NextRequest, schema: ZodType<T>): Promise<T> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new ApiError("invalid_json", "Request body must be JSON", 400);
  }
  return schema.parse(body);
}

/** CSRF guard for mutating handlers (SPEC §16/§22): Origin must match APP_URL. */
export function requireSameOrigin(req: NextRequest) {
  const origin = req.headers.get("origin");
  if (!origin) return; // non-browser clients (same-site fetch without Origin) — cookies still required
  const allowed = new Set([env.APP_URL, process.env.NEXT_PUBLIC_APP_URL ?? ""].filter(Boolean));
  if (!allowed.has(origin.replace(/\/$/, ""))) {
    throw new ApiError("bad_origin", "Cross-site request rejected", 403);
  }
}

export function getClientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "127.0.0.1";
}

export interface AuthContext {
  userId: string;
  email: string;
  profile: Profile;
}

/** Current signed-in user + profile. Throws 401 / 403 (banned). */
export async function requireUser(): Promise<AuthContext> {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new ApiError("unauthorized", "Please sign in", 401);
  const { data: profile } = await supabaseAdmin().from("profiles").select("*").eq("id", user.id).maybeSingle();
  if (!profile) throw new ApiError("no_profile", "Profile not found", 401);
  if (profile.banned_at) throw new ApiError("banned", profile.ban_reason ?? "Account suspended", 403);
  return { userId: user.id, email: profile.email, profile };
}

export async function requireAdmin(): Promise<AuthContext> {
  const ctx = await requireUser();
  if (ctx.profile.role !== "admin") throw new ApiError("forbidden", "Admin only", 403);
  return ctx;
}

export async function audit(
  actorId: string | null,
  action: string,
  target?: { type: string; id: string },
  payload?: Record<string, unknown>,
  ip?: string,
) {
  await supabaseAdmin()
    .from("audit_log")
    .insert({
      actor_id: actorId,
      action,
      target_type: target?.type ?? null,
      target_id: target?.id ?? null,
      payload: (payload ?? null) as never,
      ip: ip ?? null,
    });
}
