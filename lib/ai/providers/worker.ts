import "server-only";
import { env } from "@/lib/env";
import { ProviderError, type PollResult, type ProviderAdapter, type SubmitResult } from "./types";

/**
 * Modal worker adapter (SPEC §14.2). Endpoints are protected by a bearer token; inputs and
 * outputs travel via presigned R2 URLs. The worker answers 202 { task_id } and either calls
 * /api/webhooks/worker (HMAC) or is polled via GET /tasks/{task_id}.
 */
export type WorkerTask =
  | {
      endpoint: "rig-animate";
      image_url: string;
      clips: string[];
      fps: number;
      frame_size: number;
      mirror: boolean;
      output_put_url: string; // presigned PUT for the resulting frames ZIP
    }
  | { endpoint: "convert-3d"; model_url: string; targets: string[]; scale_m?: number | null; output_put_urls: Record<string, string> }
  | { endpoint: "render-thumbnail"; model_url: string; output_put_url: string; gif_put_url?: string }
  | { endpoint: "audio-process"; audio_url: string; ops: Record<string, unknown>; output_put_urls: Record<string, string> }
  | { endpoint: "make-gif"; frames_zip_url: string; fps: number; output_put_url: string }
  | { endpoint: "pixelize"; frames_zip_url: string; pixel_grid: number; palette: string[] | null; palette_size: number; output_put_url: string };

export interface WorkerOutput {
  task_id: string;
  outputs: Record<string, unknown>;
}

function headers() {
  if (!env.MODAL_WORKER_URL || !env.MODAL_WORKER_TOKEN) throw new ProviderError("Modal worker is not configured");
  return { Authorization: `Bearer ${env.MODAL_WORKER_TOKEN}`, "Content-Type": "application/json" };
}

export const workerAdapter: ProviderAdapter<WorkerTask, WorkerOutput> = {
  id: "worker",
  async submit(task): Promise<SubmitResult<WorkerOutput>> {
    const { endpoint, ...body } = task;
    const res = await fetch(`${env.MODAL_WORKER_URL}/${endpoint}`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      if (res.status === 422 && /riggable|skeleton|pose/i.test(text)) throw new ProviderError(text, "not_riggable");
      throw new ProviderError(`Worker ${endpoint} failed (${res.status}): ${text.slice(0, 200)}`);
    }
    const json = (await res.json()) as { task_id?: string; outputs?: Record<string, unknown> };
    if (json.outputs && !json.task_id) return { result: { task_id: "sync", outputs: json.outputs } };
    return { providerJobId: json.task_id! };
  },
  async poll(id): Promise<PollResult<WorkerOutput>> {
    const res = await fetch(`${env.MODAL_WORKER_URL}/tasks/${id}`, { headers: headers() });
    if (!res.ok) return { status: "error", error: `Worker task status ${res.status}` };
    const json = (await res.json()) as { status: string; progress?: number; outputs?: Record<string, unknown>; error?: string };
    if (json.status === "done") return { status: "done", result: { task_id: id, outputs: json.outputs ?? {} } };
    if (json.status === "error") return { status: "error", error: json.error ?? "Worker task failed" };
    return { status: "pending", progress: json.progress };
  },
  estimateCostUsd(task) {
    return task.endpoint === "rig-animate" ? 0.05 : 0.01;
  },
};
