import type { Database } from "@/lib/supabase/database.types";

export type PlanTier = Database["public"]["Enums"]["plan_tier"];

export interface PlanConfig {
  id: PlanTier;
  name: string;
  priceUsd: number | null;
  billing: "none" | "one_time" | "monthly";
  credits: number;
  concurrency: number;
  storageBytes: number;
  retentionDays: number | null; // null = while subscription active
  /** Photos that can be attached to one 3D job (SPEC §9.3). Trial is capped at 1. */
  maxInputImages: number;
  textures4k: boolean;
  teamWorkspaces: boolean;
  seats: number;
}

const GB = 1024 ** 3;

// SPEC §11.3
export const PLANS: Record<PlanTier, PlanConfig> = {
  none: {
    id: "none",
    name: "Free",
    priceUsd: null,
    billing: "none",
    credits: 0,
    concurrency: 1,
    storageBytes: 0.5 * GB,
    retentionDays: 30,
    maxInputImages: 1,
    textures4k: false,
    teamWorkspaces: false,
    seats: 1,
  },
  trial: {
    id: "trial",
    name: "Trial",
    priceUsd: 1.69,
    billing: "one_time",
    credits: 86,
    concurrency: 1,
    storageBytes: 2 * GB,
    retentionDays: 30,
    maxInputImages: 1,
    textures4k: false,
    teamWorkspaces: false,
    seats: 1,
  },
  pro: {
    id: "pro",
    name: "Pro",
    priceUsd: 15,
    billing: "monthly",
    credits: 1000,
    concurrency: 2,
    storageBytes: 25 * GB,
    retentionDays: null,
    maxInputImages: 3,
    textures4k: false,
    teamWorkspaces: false,
    seats: 1,
  },
  studio: {
    id: "studio",
    name: "Studio",
    priceUsd: 45,
    billing: "monthly",
    credits: 3200,
    concurrency: 5,
    storageBytes: 100 * GB,
    retentionDays: null,
    maxInputImages: 3,
    textures4k: true,
    teamWorkspaces: true,
    seats: 5,
  },
};

// SPEC §11.4 — Pack S price is a placeholder until decided by the owner (§27 pkt 2); Pack L decided 2026-09-25.
export const CREDIT_PACKS = [
  { id: "pack_1000", name: "Pack S", credits: 1000, priceUsd: 19, placeholder: true },
  { id: "pack_10000", name: "Pack L", credits: 10000, priceUsd: 180, placeholder: false },
] as const;

export type CheckoutKind = "trial" | "pro" | "studio" | "pack_1000" | "pack_10000";

export const TRIAL_DAYS = 30;
export const SUBSCRIPTION_GRACE_DAYS = 3;
export const RETENTION_GRACE_DAYS = 90;
export const TRASH_DAYS = 14;
export const MAX_QUEUED_JOBS_PER_WORKSPACE = 20;

export function planFor(tier: PlanTier | null | undefined): PlanConfig {
  return PLANS[tier ?? "none"] ?? PLANS.none;
}

/** Retention for new assets given the workspace plan (SPEC §13). */
export function assetExpiryFor(tier: PlanTier): Date | null {
  const p = planFor(tier);
  if (p.retentionDays === null) return null;
  return new Date(Date.now() + p.retentionDays * 86_400_000);
}
