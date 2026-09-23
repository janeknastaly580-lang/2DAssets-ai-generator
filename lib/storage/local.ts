import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { env } from "@/lib/env";
import { mimeFor } from "./keys";
import type { StorageDriver, PresignGetOptions, PutOptions } from "./index";

/**
 * Local-disk storage for development (no R2 yet). Files live under `.data/storage/<key>`.
 * "Presigned" URLs are HMAC-signed links served by `/api/files` with the same TTL semantics as R2.
 */
export const LOCAL_ROOT = path.join(process.cwd(), ".data", "storage");

function safeKey(key: string) {
  if (key.includes("..") || path.isAbsolute(key)) throw new Error("Invalid storage key");
  return key.replace(/\\/g, "/");
}

function filePath(key: string) {
  return path.join(LOCAL_ROOT, ...safeKey(key).split("/"));
}

export function signLocalUrl(params: Record<string, string>): string {
  const base = new URLSearchParams(params).toString();
  const sig = createHmac("sha256", env.AUTH_CODE_PEPPER).update(base).digest("base64url");
  return `${env.APP_URL}/api/files?${base}&sig=${sig}`;
}

export function verifyLocalSignature(search: URLSearchParams): boolean {
  const sig = search.get("sig") ?? "";
  const params = new URLSearchParams(search);
  params.delete("sig");
  const expected = createHmac("sha256", env.AUTH_CODE_PEPPER).update(params.toString()).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
  const exp = Number(search.get("exp") ?? 0);
  return exp * 1000 > Date.now();
}

export function localStorageDriver(): StorageDriver {
  return {
    id: "local",
    async put(key, body, _opts: PutOptions) {
      const p = filePath(key);
      await fs.mkdir(path.dirname(p), { recursive: true });
      const buf = typeof body === "string" ? Buffer.from(body) : Buffer.from(body);
      await fs.writeFile(p, buf);
      return { size: buf.byteLength };
    },
    async get(key) {
      return fs.readFile(filePath(key));
    },
    async head(key) {
      try {
        const st = await fs.stat(filePath(key));
        return { size: st.size, contentType: mimeFor(key) };
      } catch {
        return null;
      }
    },
    async delete(key) {
      await fs.rm(filePath(key), { force: true });
    },
    async deletePrefix(prefix) {
      const dir = filePath(prefix.replace(/\/$/, ""));
      try {
        const before = await countFiles(dir);
        await fs.rm(dir, { recursive: true, force: true });
        return before;
      } catch {
        return 0;
      }
    },
    async presignGet(key, opts: PresignGetOptions = {}) {
      const exp = Math.floor(Date.now() / 1000) + (opts.ttl ?? 15 * 60);
      return signLocalUrl({
        key: safeKey(key),
        exp: String(exp),
        ...(opts.filename ? { dl: opts.filename } : {}),
        ...(opts.inline ? { inline: "1" } : {}),
      });
    },
    async presignPut(key, contentType, maxBytes, ttlSeconds = 10 * 60) {
      const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
      return signLocalUrl({ key: safeKey(key), exp: String(exp), put: "1", ct: contentType, max: String(maxBytes) });
    },
  };
}

async function countFiles(dir: string): Promise<number> {
  let n = 0;
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    if (e.isDirectory()) n += await countFiles(path.join(dir, e.name));
    else n++;
  }
  return n;
}
