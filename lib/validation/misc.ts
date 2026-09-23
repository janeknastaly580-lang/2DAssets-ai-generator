import { z } from "zod";

export const ENGINE_PRESETS = ["unity", "unreal", "godot", "generic"] as const;
export type EnginePreset = (typeof ENGINE_PRESETS)[number];

export const checkoutSchema = z.object({
  workspace_id: z.string().uuid(),
  kind: z.enum(["trial", "pro", "studio", "pack_1000", "pack_10000"]),
});

export const portalSchema = z.object({ workspace_id: z.string().uuid() });

export const createShareSchema = z.object({
  target_type: z.enum(["asset", "project"]),
  target_id: z.string().uuid(),
  allow_download: z.boolean().default(false),
  show_prompt: z.boolean().default(false),
  expires_in_days: z.union([z.literal(7), z.literal(30), z.literal(90), z.null()]).default(30),
});

export const createWorkspaceSchema = z.object({ name: z.string().trim().min(2).max(60) });
export const updateWorkspaceSchema = z.object({ name: z.string().trim().min(2).max(60).optional() });

export const inviteSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  role: z.enum(["admin", "member", "viewer"]).default("member"),
});
export const memberRoleSchema = z.object({ role: z.enum(["admin", "member", "viewer"]) });

export const updateAssetSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  tags: z.array(z.string().trim().min(1).max(30)).max(20).optional(),
  project_id: z.string().uuid().optional(),
});

export const downloadRequestSchema = z
  .object({
    asset_ids: z.array(z.string().uuid()).min(1).max(200).optional(),
    project_id: z.string().uuid().optional(),
    engine_preset: z.enum(ENGINE_PRESETS).default("generic"),
  })
  .refine((v) => Boolean(v.asset_ids?.length) !== Boolean(v.project_id), {
    message: "Provide asset_ids or project_id",
  });

export const presignUploadSchema = z.object({
  filename: z.string().min(1).max(200),
  mime: z.enum(["image/png", "image/jpeg", "image/webp"]),
  size_bytes: z.number().int().positive().max(10 * 1024 * 1024),
  purpose: z.enum(["reference", "image_input", "avatar"]).default("reference"),
});

export const completeUploadSchema = z.object({ upload_id: z.string().uuid() });

export const updateProfileSchema = z.object({
  display_name: z.string().trim().min(1).max(60).optional(),
  marketing_consent: z.boolean().optional(),
  notification_prefs: z
    .object({ job_completed: z.boolean().optional(), assets_expiring: z.boolean().optional() })
    .optional(),
});

export const adminCreditsSchema = z.object({
  workspace_id: z.string().uuid(),
  amount: z.number().int().min(-100000).max(100000).refine((n) => n !== 0, "Amount cannot be 0"),
  reason: z.string().trim().min(3).max(300),
});

export const adminUserPatchSchema = z.object({
  ban: z.boolean().optional(),
  ban_reason: z.string().trim().max(300).optional(),
  role: z.enum(["user", "admin"]).optional(),
  sign_out: z.boolean().optional(),
});

export const adminPricingSchema = z.object({
  id: z.string().min(1),
  credits: z.number().int().min(0).max(10000).optional(),
  provider_model: z.string().min(1).max(120).optional(),
  enabled: z.boolean().optional(),
  est_provider_cost_usd: z.number().min(0).optional(),
  params: z.record(z.string(), z.unknown()).optional(),
});

export const adminFlagSchema = z.object({
  key: z.string().min(1).max(80),
  enabled: z.boolean().optional(),
  payload: z.record(z.string(), z.unknown()).optional(),
});

export const adminWorkspacePatchSchema = z.object({
  plan: z.enum(["none", "trial", "pro", "studio"]).optional(),
  reason: z.string().trim().min(3).max(300),
});
