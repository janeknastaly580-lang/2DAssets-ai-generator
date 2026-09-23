import type { Database } from "@/lib/supabase/database.types";
import type { TranslatorOutput } from "@/lib/ai/translator";
import type { StyleGuide } from "@/lib/validation/project";
import type { AssetType } from "@/lib/validation/jobs";

export type JobRow = Database["public"]["Tables"]["jobs"]["Row"];
export type ProjectRow = Database["public"]["Tables"]["projects"]["Row"];
export type WorkspaceRow = Database["public"]["Tables"]["workspaces"]["Row"];
export type AssetRow = Database["public"]["Tables"]["assets"]["Row"];
export type AssetFileRow = Database["public"]["Tables"]["asset_files"]["Row"];

/** Runtime hooks so the same pipeline code runs inline (dev) or inside Inngest steps. */
export interface PipelineRuntime {
  sleep(ms: number): Promise<void>;
  log(msg: string, data?: Record<string, unknown>): void;
}

export interface PipelineContext<TInput> {
  job: JobRow;
  input: TInput;
  project: ProjectRow;
  styleGuide: StyleGuide;
  workspace: WorkspaceRow;
  translated: TranslatorOutput;
  rt: PipelineRuntime;
  setProgress(progress: number): Promise<void>;
  /** throws if the user cancelled the job meanwhile */
  assertActive(): Promise<void>;
  /** provider job id persisted for idempotent resume */
  setProviderJob(provider: string, model: string, providerJobId: string | null): Promise<void>;
}

export interface OutputFile {
  format: string; // png|webp|gif|json_atlas|tres|glb|gltf|bin|fbx|obj|mtl|wav|ogg|mp3|zip|texture_png|md
  variant: string | null; // e.g. 'sheet', 'frames', 'unity', 'unreal', 'loop', 'albedo', 'x4'
  engine_preset: string | null;
  ext: string;
  body: Buffer;
}

export interface OutputAsset {
  type: AssetType;
  name: string;
  prompt: string;
  metadata: Record<string, unknown>;
  files: OutputFile[];
  preview?: Buffer; // PNG
  animatedPreview?: Buffer; // GIF
  parentAssetId?: string | null;
  providerCostUsd: number;
}

export interface PipelineResult {
  assets: OutputAsset[];
  providerCostUsd: number;
  /** actual credits if they differ from the estimate (e.g. fewer variants returned) */
  creditsActual?: number;
}

export class JobFailure extends Error {
  constructor(
    public code: string,
    message: string,
    public countsAsViolation = false,
  ) {
    super(message);
    this.name = "JobFailure";
  }
}
