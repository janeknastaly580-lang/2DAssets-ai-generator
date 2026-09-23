import { NextResponse, type NextRequest } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import { integrations } from "@/lib/env";
import { LOCAL_ROOT, verifyLocalSignature } from "@/lib/storage/local";
import { mimeFor } from "@/lib/storage/keys";

/**
 * Local-storage gateway (dev only, when R2 is not configured). Serves/accepts files under
 * `.data/storage` for HMAC-signed, time-limited URLs produced by the local driver — the
 * equivalent of R2 presigned GET/PUT.
 */
function guard(req: NextRequest): { key: string } | NextResponse {
  if (integrations.r2) return NextResponse.json({ ok: false, error: { code: "disabled" } }, { status: 404 });
  const sp = req.nextUrl.searchParams;
  if (!verifyLocalSignature(sp)) {
    return NextResponse.json({ ok: false, error: { code: "bad_signature", message: "Link expired or invalid" } }, { status: 403 });
  }
  const key = sp.get("key") ?? "";
  if (!key || key.includes("..") || path.isAbsolute(key)) {
    return NextResponse.json({ ok: false, error: { code: "bad_key" } }, { status: 400 });
  }
  return { key };
}

export async function GET(req: NextRequest) {
  const g = guard(req);
  if (g instanceof NextResponse) return g;
  const sp = req.nextUrl.searchParams;
  if (sp.get("put")) return NextResponse.json({ ok: false, error: { code: "method" } }, { status: 405 });
  try {
    const buf = await fs.readFile(path.join(LOCAL_ROOT, ...g.key.split("/")));
    const headers: Record<string, string> = {
      "Content-Type": mimeFor(g.key),
      "Cache-Control": "private, max-age=300",
      "X-Content-Type-Options": "nosniff",
    };
    const dl = sp.get("dl");
    if (dl) headers["Content-Disposition"] = `attachment; filename="${dl.replace(/"/g, "")}"`;
    else if (sp.get("inline")) headers["Content-Disposition"] = "inline";
    return new NextResponse(new Uint8Array(buf), { headers });
  } catch {
    return NextResponse.json({ ok: false, error: { code: "not_found" } }, { status: 404 });
  }
}

export async function PUT(req: NextRequest) {
  const g = guard(req);
  if (g instanceof NextResponse) return g;
  const sp = req.nextUrl.searchParams;
  if (!sp.get("put")) return NextResponse.json({ ok: false, error: { code: "method" } }, { status: 405 });
  const max = Number(sp.get("max") ?? 0);
  const body = Buffer.from(await req.arrayBuffer());
  if (max && body.byteLength > max) return NextResponse.json({ ok: false, error: { code: "too_large" } }, { status: 413 });
  const p = path.join(LOCAL_ROOT, ...g.key.split("/"));
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, body);
  return new NextResponse(null, { status: 200, headers: { ETag: `"${body.byteLength}"` } });
}
