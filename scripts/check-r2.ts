/**
 * SPEC §13, §23.2 — end-to-end check of the Cloudflare R2 bucket: PUT → HEAD → GET →
 * presigned GET (real HTTP fetch) → DELETE on a throwaway key. Run it after pasting
 * R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY into .env.local.
 * Usage: pnpm r2:check
 */
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import {
  DeleteObjectCommand,
  GetBucketCorsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/** Minimal .env loader (.env then .env.local, later wins) — same order Next.js uses. */
function loadEnvFiles() {
  for (const file of [".env", ".env.local"]) {
    if (!existsSync(file)) continue;
    for (const raw of readFileSync(file, "utf8").split(/\r?\n/)) {
      const m = raw.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
      if (!m) continue;
      process.env[m[1]] = m[2].trim().replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1");
    }
  }
}
loadEnvFiles();

const accountId = process.env.R2_ACCOUNT_ID ?? "";
const accessKeyId = process.env.R2_ACCESS_KEY_ID ?? "";
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY ?? "";
const Bucket = process.env.R2_BUCKET ?? "";
const endpoint = process.env.R2_ENDPOINT || (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : "");
const appUrl = (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");

const missing = Object.entries({ R2_ACCOUNT_ID: accountId, R2_ACCESS_KEY_ID: accessKeyId, R2_SECRET_ACCESS_KEY: secretAccessKey, R2_BUCKET: Bucket })
  .filter(([, v]) => !v)
  .map(([k]) => k);
if (missing.length) {
  console.error(`✗ missing in .env/.env.local: ${missing.join(", ")}`);
  console.error("  Storage is still using the local disk driver (.data/storage) — see SPEC.md §23.2.");
  process.exit(1);
}

const s3 = new S3Client({
  region: "auto",
  endpoint,
  credentials: { accessKeyId, secretAccessKey },
  forcePathStyle: true,
});

const key = `_healthcheck/${randomUUID()}.txt`;
const payload = `veyraflow r2 check ${new Date().toISOString()}`;

function explain(err: unknown): string {
  const e = err as { name?: string; Code?: string; $metadata?: { httpStatusCode?: number }; message?: string };
  const code = e?.name ?? e?.Code ?? "";
  if (/InvalidAccessKeyId|SignatureDoesNotMatch/.test(code)) return "wrong R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY";
  if (/NoSuchBucket/.test(code)) return `bucket "${Bucket}" does not exist on this account`;
  if (/AccessDenied|Forbidden/.test(code)) return "the API token lacks Object Read & Write on this bucket";
  if (/ENOTFOUND|EAI_AGAIN|getaddrinfo/.test(String(e?.message))) return `endpoint ${endpoint} does not resolve — check R2_ACCOUNT_ID`;
  return `${code}: ${e?.message ?? String(err)}`;
}

async function main() {
  console.log(`→ endpoint ${endpoint}`);
  console.log(`→ bucket   ${Bucket}`);

  await s3.send(new PutObjectCommand({ Bucket, Key: key, Body: Buffer.from(payload), ContentType: "text/plain" }));
  console.log("✓ PUT");

  const head = await s3.send(new HeadObjectCommand({ Bucket, Key: key }));
  if (head.ContentLength !== Buffer.byteLength(payload)) throw new Error(`HEAD size mismatch: ${head.ContentLength}`);
  console.log(`✓ HEAD (${head.ContentLength} B, ${head.ContentType})`);

  const got = await s3.send(new GetObjectCommand({ Bucket, Key: key }));
  const body = Buffer.from(await got.Body!.transformToByteArray()).toString();
  if (body !== payload) throw new Error("GET body mismatch");
  console.log("✓ GET");

  const url = await getSignedUrl(s3, new GetObjectCommand({ Bucket, Key: key }), { expiresIn: 900 });
  const res = await fetch(url);
  if (!res.ok) throw new Error(`presigned GET returned HTTP ${res.status}`);
  if ((await res.text()) !== payload) throw new Error("presigned GET body mismatch");
  console.log("✓ presigned GET (15 min TTL)");

  await s3.send(new DeleteObjectCommand({ Bucket, Key: key }));
  if (await s3.send(new HeadObjectCommand({ Bucket, Key: key })).then(() => true).catch(() => false)) {
    throw new Error("object still present after DELETE");
  }
  console.log("✓ DELETE");

  // Browser uploads (SPEC §13) need CORS on the bucket. Informational: reading the CORS
  // policy needs an admin-scoped token, so a failure here is not a failure of the check.
  try {
    const cors = await s3.send(new GetBucketCorsCommand({ Bucket }));
    const origins = (cors.CORSRules ?? []).flatMap((r) => r.AllowedOrigins ?? []);
    if (origins.some((o) => o === "*" || o === appUrl)) console.log(`✓ CORS allows ${appUrl}`);
    else console.warn(`! CORS rules do not list ${appUrl} (browser uploads will fail) — SPEC §23.2 step 3`);
  } catch {
    console.info("(CORS policy not readable with this token — verify it in the dashboard, SPEC §23.2 step 3)");
  }

  console.log("\n✓ R2 works — storage() now resolves to the r2 driver (lib/storage/index.ts).");
}

main().catch((err) => {
  console.error(`✗ R2 check failed: ${explain(err)}`);
  process.exit(1);
});
