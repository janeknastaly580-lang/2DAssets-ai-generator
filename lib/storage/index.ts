import "server-only";
import { integrations } from "@/lib/env";
import { r2Storage } from "./r2";
import { localStorageDriver } from "./local";

export interface PutOptions {
  contentType: string;
  cacheControl?: string;
}

export interface PresignGetOptions {
  /** seconds; SPEC §13: GET 15 min */
  ttl?: number;
  /** Content-Disposition attachment filename */
  filename?: string;
  inline?: boolean;
}

export interface StorageDriver {
  readonly id: "r2" | "local";
  put(key: string, body: Buffer | Uint8Array | string, opts: PutOptions): Promise<{ size: number }>;
  get(key: string): Promise<Buffer>;
  head(key: string): Promise<{ size: number; contentType: string } | null>;
  delete(key: string): Promise<void>;
  deletePrefix(prefix: string): Promise<number>;
  presignGet(key: string, opts?: PresignGetOptions): Promise<string>;
  presignPut(key: string, contentType: string, maxBytes: number, ttlSeconds?: number): Promise<string>;
}

/**
 * Storage entry point (SPEC §13). Uses Cloudflare R2 when configured, otherwise a local-disk
 * driver under `.data/storage` so the whole app runs on localhost without any cloud bucket.
 */
export function storage(): StorageDriver {
  return integrations.r2 ? r2Storage() : localStorageDriver();
}

/**
 * Account deletion (SPEC §21.5): every file of the user's workspaces (assets, references, uploads,
 * ZIP downloads) plus `users/<id>/` (avatar, data exports). Throws on failure — callers must run it
 * before deleting the DB rows, otherwise the orphaned keys can never be found again.
 */
export async function deleteUserFiles(userId: string, workspaceIds: string[]) {
  const st = storage();
  for (const ws of workspaceIds) {
    await st.deletePrefix(`ws/${ws}/`);
    await st.deletePrefix(`downloads/${ws}/`);
  }
  await st.deletePrefix(`users/${userId}/`);
}

export { storageKeys, mimeFor, extForMime } from "./keys";
