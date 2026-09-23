import { z } from "zod";

export const ART_STYLES = [
  "pixel art",
  "hand-painted",
  "cartoon",
  "anime",
  "flat vector",
  "low-poly 3D",
  "realistic",
  "voxel",
  "custom",
] as const;

export const PERSPECTIVES = ["side", "top-down", "isometric", "3/4", "front", "any"] as const;
export const TARGET_ENGINES = ["unity", "unreal", "godot"] as const;
export const PIXEL_GRIDS = [16, 32, 48, 64, 96, 128] as const;

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use #RRGGBB");

// SPEC §7.1 style_guide jsonb
export const styleGuideSchema = z.object({
  art_style: z.string().max(80).optional().nullable(),
  style_notes: z.string().max(1000).optional().nullable(),
  palette: z.array(hex).max(64).optional().nullable(),
  palette_locked: z.boolean().optional().default(false),
  perspective: z.enum(PERSPECTIVES).optional().nullable(),
  pixel_grid: z.number().int().min(8).max(256).optional().nullable(),
  mood: z.string().max(200).optional().nullable(),
  target_engine: z.enum(TARGET_ENGINES).optional().nullable(),
  audio_notes: z.string().max(500).optional().nullable(),
  voice_defaults: z.object({ language: z.string().max(10).optional() }).optional().nullable(),
});

export type StyleGuide = z.infer<typeof styleGuideSchema>;

export const createProjectSchema = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(1000).optional().nullable(),
  style_guide: styleGuideSchema.optional().default({ palette_locked: false }),
});

export const updateProjectSchema = createProjectSchema.partial().extend({
  archived: z.boolean().optional(),
  cover_asset_id: z.string().uuid().nullable().optional(),
});

export const addReferenceSchema = z
  .object({
    kind: z.enum(["style", "character", "palette"]),
    label: z.string().trim().max(80).optional().nullable(),
    upload_id: z.string().uuid().optional(),
    asset_id: z.string().uuid().optional(),
  })
  .refine((v) => Boolean(v.upload_id) !== Boolean(v.asset_id), { message: "Provide upload_id or asset_id" });

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
