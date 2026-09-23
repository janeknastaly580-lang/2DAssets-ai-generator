import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import { moderatePrompt, MODERATION_PROMPT_VERSION } from "@/lib/ai/moderation";
import { translatePrompt, TRANSLATOR_PROMPT_VERSION, TranslationDroppedInfoError } from "@/lib/ai/translator";
import { falModelFor, llmParamsForTranslator } from "@/lib/ai/falModels";
import { ProviderError } from "@/lib/ai/providers/types";
import { releaseReservation, settleJobCredits } from "@/lib/credits/ledger";
import { sendTemplateEmail } from "@/lib/email/resend";
import { getFlag } from "@/lib/flags";
import { ASSET_TYPES, parseJobInput, type AssetType, type JobInput, type VoiceInput } from "@/lib/validation/jobs";
import { styleGuideSchema, type StyleGuide } from "@/lib/validation/project";
import { runModel3dPipeline } from "./model3d";
import { runMusicPipeline, runSfxPipeline, runVoicePipeline } from "./audio";
import { persistOutputs } from "./finalize";
import { JobFailure, type JobRow, type PipelineContext, type PipelineResult, type PipelineRuntime } from "./types";

const TERMINAL = new Set(["completed", "failed", "rejected", "cancelled"]);

export const inlineRuntime: PipelineRuntime = {
  sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
  log: (msg, data) => console.info(`[pipeline] ${msg}`, data ?? ""),
};

/** Text the moderation filter sees (SPEC §12.1). */
export function moderationTextFor(type: AssetType, input: JobInput): string {
  if (type === "audio_voice") {
    const v = input as VoiceInput;
    return [v.text, v.instructions].filter(Boolean).join("\n");
  }
  return ((input as { prompt?: string }).prompt ?? "").toString();
}

/**
 * The universal generation pipeline (SPEC §8). Idempotent per stage: re-running a job resumes
 * from its persisted status. Used by the Inngest function and by the inline dev fallback.
 */
export async function runGenerationJob(jobId: string, rt: PipelineRuntime = inlineRuntime): Promise<void> {
  const db = supabaseAdmin();
  const { data: job } = await db.from("jobs").select("*").eq("id", jobId).maybeSingle();
  if (!job) throw new Error(`job ${jobId} not found`);
  if (TERMINAL.has(job.status)) return;

  const { data: workspace } = await db.from("workspaces").select("*").eq("id", job.workspace_id).single();
  const { data: project } = await db.from("projects").select("*").eq("id", job.project_id ?? "").maybeSingle();
  if (!workspace || !project) {
    await failJob(job, "invalid_state", "Workspace or project no longer exists");
    return;
  }

  // The asset_type enum still carries the retired `image` / `sprite_animation` values so that
  // legacy assets stay readable (SPEC §9.0). No pipeline can run for them any more.
  if (!(ASSET_TYPES as readonly string[]).includes(job.type)) {
    await failJob(job, "pipeline_removed", "This generator is no longer available");
    return;
  }
  const jobType = job.type as AssetType;

  const update = async (patch: Partial<JobRow>) => {
    await db.from("jobs").update(patch).eq("id", jobId);
  };
  const assertActive = async () => {
    const { data } = await db.from("jobs").select("status").eq("id", jobId).single();
    if (!data || data.status === "cancelled") throw new JobFailure("cancelled", "Cancelled by user");
  };

  try {
    const input = parseJobInput(jobType, job.input);
    const styleGuide: StyleGuide = styleGuideSchema.parse(project.is_scratch ? {} : project.style_guide ?? {});

    // 3. moderation ---------------------------------------------------------
    await update({ status: "moderating", started_at: job.started_at ?? new Date().toISOString(), progress: 2 });
    const text = moderationTextFor(jobType, input);
    const mod = await moderatePrompt(text);
    await update({ moderation_model: mod.model, moderation_prompt_version: MODERATION_PROMPT_VERSION });
    if (mod.result.verdict === "block") {
      await rejectJob(job, mod.result.category ?? "other", mod.result.reason, text, mod.model);
      return;
    }

    // 4. translation --------------------------------------------------------
    await assertActive();
    await update({ status: "translating", progress: 5 });
    // The fal endpoint + the provider params the translator LLM chooses (SPEC §9.7).
    const model = falModelFor(jobType, input);
    const translated = await translatePrompt({
      asset_type: jobType,
      target_model: model.endpoint,
      user_prompt: text,
      project_style_guide: styleGuide,
      params: input as unknown as Record<string, unknown>,
      mode: jobType === "audio_voice" ? "params_only" : "full",
      model_params_spec: llmParamsForTranslator(model),
      translator_notes: model.translatorNotes,
    });
    await update({
      translated_prompt: translated.output as never,
      translator_model: translated.model,
      translator_prompt_version: TRANSLATOR_PROMPT_VERSION,
    });

    // 5–7. generate + post-process + upload ----------------------------------
    await assertActive();
    await update({ status: "generating", progress: 8 });
    const ctx: PipelineContext<JobInput> = {
      job,
      input,
      project,
      styleGuide,
      workspace,
      translated: translated.output,
      rt,
      setProgress: async (p) => {
        await update({ progress: Math.max(0, Math.min(99, Math.round(p))) });
      },
      assertActive,
      setProviderJob: async (provider, model, providerJobId) => {
        await update({ provider, provider_model: model, provider_job_id: providerJobId });
      },
    };

    let result: PipelineResult;
    switch (jobType) {
      case "model_3d":
        result = await runModel3dPipeline(ctx as PipelineContext<never>);
        break;
      case "audio_sfx":
        result = await runSfxPipeline(ctx as PipelineContext<never>);
        break;
      case "audio_music":
        result = await runMusicPipeline(ctx as PipelineContext<never>);
        break;
      case "audio_voice":
        result = await runVoicePipeline(ctx as PipelineContext<never>);
        break;
    }

    await assertActive();
    await update({ status: "post_processing", progress: 88 });
    await update({ status: "uploading", progress: 92 });
    const assetIds = await persistOutputs(job, workspace, result.assets);

    // 8. finalize -----------------------------------------------------------
    const charged = await settleJobCredits(jobId, result.creditsActual ?? job.credits_estimated);
    await update({
      status: "completed",
      progress: 100,
      result_asset_ids: assetIds,
      provider_cost_usd: result.providerCostUsd,
      credits_charged: charged,
      finished_at: new Date().toISOString(),
    });
    rt.log("job completed", { jobId, assets: assetIds.length, charged });
    await notifyCompleted(job, assetIds[0], result.assets[0]?.name);
  } catch (e) {
    if (e instanceof JobFailure && e.code === "cancelled") {
      await releaseReservation(jobId);
      await update({ status: "cancelled", finished_at: new Date().toISOString() });
      return;
    }
    if (e instanceof ProviderError && e.code === "provider_policy") {
      await failJob(job, "provider_policy", "The provider rejected this request under its content policy. Credits were not charged.");
      await recordViolation(job.user_id, job, "provider_policy", "provider_policy", e.message, text_of(job), job.provider ?? "provider");
      return;
    }
    if (e instanceof TranslationDroppedInfoError) {
      await failJob(job, "translation_incomplete", `We could not translate part of your request faithfully (${e.dropped.join("; ")}). Please rephrase.`);
      return;
    }
    const code = e instanceof JobFailure ? e.code : e instanceof ProviderError ? e.code : "internal_error";
    const message = e instanceof Error ? e.message : String(e);
    console.error(`[pipeline] job ${jobId} failed:`, message);
    await failJob(job, code, env.IS_DEV ? message : friendly(code));
  }
}

function text_of(job: JobRow): string {
  try {
    const type = job.type as AssetType;
    return moderationTextFor(type, parseJobInput(type, job.input));
  } catch {
    return "";
  }
}

function friendly(code: string) {
  switch (code) {
    case "provider_timeout":
      return "The provider took too long. Credits were not charged — please try again.";
    case "not_riggable":
      return "The character could not be rigged. Use a full-body, front-facing pose with arms away from the body.";
    default:
      return "Generation failed. Credits were not charged.";
  }
}

async function failJob(job: JobRow, code: string, message: string) {
  await releaseReservation(job.id);
  await supabaseAdmin()
    .from("jobs")
    .update({ status: "failed", error_code: code, error_message: message.slice(0, 500), finished_at: new Date().toISOString() })
    .eq("id", job.id);
}

async function rejectJob(job: JobRow, category: string, reason: string | null, text: string, model: string) {
  await releaseReservation(job.id);
  await supabaseAdmin()
    .from("jobs")
    .update({
      status: "rejected",
      error_code: `policy:${category}`,
      error_message: `Your prompt was rejected by our content policy: ${category}. Credits were not charged.`,
      finished_at: new Date().toISOString(),
    })
    .eq("id", job.id);
  await recordViolation(job.user_id, job, "prompt_filter", category, reason, text, model);
}

/** SPEC §12.2 — violation counter, warning at `warn_at`, automatic ban at `ban_at`, csam → instant ban. */
async function recordViolation(
  userId: string,
  job: JobRow,
  source: "prompt_filter" | "provider_policy",
  category: string,
  reason: string | null,
  text: string,
  model: string,
) {
  const db = supabaseAdmin();
  await db.from("moderation_events").insert({
    user_id: userId,
    workspace_id: job.workspace_id,
    job_id: job.id,
    source,
    verdict: "block",
    category,
    reason,
    prompt_excerpt: text.slice(0, 200),
    model,
  });
  const { data: count } = await db.rpc("record_violation", { p_user: userId });
  const thresholds = (await getFlag<{ warn_at: number; ban_at: number }>("moderation_thresholds")) ?? { warn_at: 3, ban_at: 12 };
  const { data: profile } = await db.from("profiles").select("email, banned_at").eq("id", userId).single();
  if (!profile || profile.banned_at) return;
  const n = count ?? 0;
  if (category === "csam" || n >= thresholds.ban_at) {
    const banReason = category === "csam" ? "auto:csam" : "auto:moderation";
    await db.from("profiles").update({ banned_at: new Date().toISOString(), ban_reason: banReason }).eq("id", userId);
    await db.auth.admin.signOut(userId, "global").catch(() => undefined);
    await db.from("audit_log").insert({ actor_id: null, action: "user.auto_ban", target_type: "user", target_id: userId, payload: { reason: banReason, count: n } as never });
    await sendTemplateEmail({ to: profile.email, alias: "account-banned", variables: { REASON: "Repeated content policy violations", CONTACT_EMAIL: env.SUPPORT_EMAIL } }).catch(() => undefined);
  } else if (n === thresholds.warn_at) {
    await sendTemplateEmail({ to: profile.email, alias: "moderation-warning", variables: { COUNT: n, LIMIT: thresholds.ban_at } }).catch(() => undefined);
  }
}

async function notifyCompleted(job: JobRow, assetId: string | undefined, assetName: string | undefined) {
  if (!assetId) return;
  const db = supabaseAdmin();
  const { data: profile } = await db.from("profiles").select("email, notification_prefs").eq("id", job.user_id).single();
  const prefs = (profile?.notification_prefs ?? {}) as { job_completed?: boolean };
  if (!profile || !prefs.job_completed) return;
  await sendTemplateEmail({
    to: profile.email,
    alias: "job-completed",
    variables: { ASSET_NAME: assetName ?? "Your asset", ASSET_URL: `${env.APP_URL}/app/assets/${assetId}` },
  }).catch((e) => console.warn("[email] job-completed failed", e));
}
