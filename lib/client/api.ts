"use client";

/** Browser-side helper for the JSON envelope used by all Route Handlers (SPEC §16). */
export class ApiClientError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
    public details?: unknown,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

export async function api<T = unknown>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, headers, ...rest } = init;
  const res = await fetch(path, {
    ...rest,
    headers: { ...(json !== undefined ? { "Content-Type": "application/json" } : {}), ...(headers ?? {}) },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
    credentials: "same-origin",
  });
  let payload: { ok: boolean; data?: T; error?: { code: string; message: string; details?: unknown } } | null = null;
  try {
    payload = await res.json();
  } catch {
    payload = null;
  }
  if (!res.ok || !payload?.ok) {
    const err = payload?.error;
    throw new ApiClientError(err?.code ?? "http_error", err?.message ?? `Request failed (${res.status})`, res.status, err?.details);
  }
  return payload.data as T;
}

export const post = <T = unknown>(path: string, json?: unknown) => api<T>(path, { method: "POST", json: json ?? {} });
export const patch = <T = unknown>(path: string, json?: unknown) => api<T>(path, { method: "PATCH", json: json ?? {} });
export const put = <T = unknown>(path: string, json?: unknown) => api<T>(path, { method: "PUT", json: json ?? {} });
export const del = <T = unknown>(path: string) => api<T>(path, { method: "DELETE" });

/** Uploads an image through presign → PUT → complete (SPEC §13). Returns the upload id + preview URL. */
export async function uploadImage(file: File, purpose: "reference" | "image_input" | "avatar" = "reference") {
  const mime = file.type as "image/png" | "image/jpeg" | "image/webp";
  const presign = await post<{ upload_id: string; url: string; headers: Record<string, string> }>("/api/uploads/presign", {
    filename: file.name,
    mime,
    size_bytes: file.size,
    purpose,
  });
  const putRes = await fetch(presign.url, { method: "PUT", headers: presign.headers, body: file });
  if (!putRes.ok) throw new ApiClientError("upload_failed", `Upload failed (${putRes.status})`, putRes.status);
  return post<{ upload_id: string; key: string; url: string; width: number; height: number }>("/api/uploads/complete", {
    upload_id: presign.upload_id,
  });
}
