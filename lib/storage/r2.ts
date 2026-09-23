import "server-only";
import {
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "@/lib/env";
import type { StorageDriver, PresignGetOptions, PutOptions } from "./index";

let client: S3Client | null = null;

function s3() {
  if (!client) {
    client = new S3Client({
      region: "auto",
      endpoint: env.R2_ENDPOINT,
      credentials: { accessKeyId: env.R2_ACCESS_KEY_ID, secretAccessKey: env.R2_SECRET_ACCESS_KEY },
      forcePathStyle: true,
    });
  }
  return client;
}

/** Cloudflare R2 (S3-compatible), private bucket, presigned URLs only (SPEC §13, §23.2). */
export function r2Storage(): StorageDriver {
  const Bucket = env.R2_BUCKET;
  return {
    id: "r2",
    async put(key, body, opts: PutOptions) {
      const buf = typeof body === "string" ? Buffer.from(body) : Buffer.from(body);
      await s3().send(
        new PutObjectCommand({
          Bucket,
          Key: key,
          Body: buf,
          ContentType: opts.contentType,
          CacheControl: opts.cacheControl ?? "private, max-age=0",
        }),
      );
      return { size: buf.byteLength };
    },
    async get(key) {
      const res = await s3().send(new GetObjectCommand({ Bucket, Key: key }));
      const bytes = await res.Body!.transformToByteArray();
      return Buffer.from(bytes);
    },
    async head(key) {
      try {
        const res = await s3().send(new HeadObjectCommand({ Bucket, Key: key }));
        return { size: res.ContentLength ?? 0, contentType: res.ContentType ?? "application/octet-stream" };
      } catch {
        return null;
      }
    },
    async delete(key) {
      await s3().send(new DeleteObjectCommand({ Bucket, Key: key }));
    },
    async deletePrefix(prefix) {
      let deleted = 0;
      let token: string | undefined;
      do {
        const list = await s3().send(new ListObjectsV2Command({ Bucket, Prefix: prefix, ContinuationToken: token }));
        const keys = (list.Contents ?? []).map((o) => ({ Key: o.Key! }));
        if (keys.length) {
          await s3().send(new DeleteObjectsCommand({ Bucket, Delete: { Objects: keys } }));
          deleted += keys.length;
        }
        token = list.IsTruncated ? list.NextContinuationToken : undefined;
      } while (token);
      return deleted;
    },
    async presignGet(key, opts: PresignGetOptions = {}) {
      const cmd = new GetObjectCommand({
        Bucket,
        Key: key,
        ResponseContentDisposition: opts.filename
          ? `${opts.inline ? "inline" : "attachment"}; filename="${opts.filename.replace(/"/g, "")}"`
          : undefined,
      });
      return getSignedUrl(s3(), cmd, { expiresIn: opts.ttl ?? 15 * 60 });
    },
    async presignPut(key, contentType, maxBytes, ttlSeconds = 10 * 60) {
      const cmd = new PutObjectCommand({ Bucket, Key: key, ContentType: contentType, ContentLength: maxBytes });
      return getSignedUrl(s3(), cmd, { expiresIn: ttlSeconds });
    },
  };
}
