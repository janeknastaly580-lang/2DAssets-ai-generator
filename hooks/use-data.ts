"use client";

import { useQuery, useMutation, useQueryClient, type UseQueryOptions } from "@tanstack/react-query";
import { api, post } from "@/lib/client/api";
import type { StyleGuide } from "@/lib/validation/project";

export interface ProjectRow {
  id: string;
  workspace_id: string;
  name: string;
  slug: string;
  description: string | null;
  style_guide: StyleGuide;
  is_scratch: boolean;
  cover_asset_id: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
  asset_count?: number;
  cover_preview_key?: string | null;
}

export interface AssetRow {
  id: string;
  workspace_id: string;
  project_id: string;
  type: string;
  name: string;
  slug: string;
  status: "processing" | "ready" | "failed";
  source_job_id: string | null;
  parent_asset_id: string | null;
  prompt: string | null;
  metadata: Record<string, unknown>;
  tags: string[];
  preview_key: string | null;
  animated_preview_key: string | null;
  preview_url: string | null;
  animated_preview_url: string | null;
  size_bytes: number;
  created_by: string | null;
  expires_at: string | null;
  deleted_at: string | null;
  created_at: string;
}

export interface AssetFile {
  id: string;
  format: string;
  variant: string | null;
  engine_preset: string | null;
  r2_key: string;
  size_bytes: number;
  url: string;
  ext: string;
}

export interface JobRow {
  id: string;
  workspace_id: string;
  project_id: string | null;
  user_id: string;
  type: string;
  status: string;
  progress: number;
  input: Record<string, unknown>;
  credits_estimated: number;
  credits_charged: number | null;
  error_code: string | null;
  error_message: string | null;
  result_asset_ids: string[];
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
}

export function useProjects(opts?: Partial<UseQueryOptions<ProjectRow[]>>) {
  return useQuery<ProjectRow[]>({ queryKey: ["projects"], queryFn: () => api<ProjectRow[]>("/api/projects"), ...opts });
}

export function useAssets(params: Record<string, string | undefined>) {
  const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v) as [string, string][]).toString();
  return useQuery<{ items: AssetRow[]; next_cursor: string | null }>({
    queryKey: ["assets", qs],
    queryFn: () => api(`/api/assets?${qs}`),
  });
}

export function useJobs(params: Record<string, string | undefined>, refetchInterval?: number | false) {
  const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v) as [string, string][]).toString();
  return useQuery<JobRow[]>({ queryKey: ["jobs", qs], queryFn: () => api(`/api/jobs?${qs}`), refetchInterval });
}

export function useBillingSummary(page = 0) {
  return useQuery({ queryKey: ["billing", page], queryFn: () => api<BillingSummary>(`/api/billing/summary?page=${page}`) });
}

export interface BillingSummary {
  workspace: { id: string; name: string; type: string; plan: string; subscription_status: string; current_period_end: string | null; cancel_at_period_end: boolean; storage_used_bytes: number; storage_quota_bytes: number; grace_until: string | null };
  role: string;
  plan_pool: number;
  balance: { trial_available: number; trial_expires_at: string | null; subscription_available: number; subscription_expires_at: string | null; purchased_available: number; reserved: number; available: number };
  trial_available_to_buy: boolean;
  billing_configured: boolean;
  ledger: { id: number; kind: string; bucket: string | null; delta: number; description: string | null; created_at: string; job_id: string | null }[];
  ledger_total: number;
  page: number;
  page_size: number;
  usage_30d: { day: string; credits: number }[];
  packs: { id: string; name: string; credits: number; priceUsd: number; placeholder: boolean }[];
}

export function useInvalidate() {
  const qc = useQueryClient();
  return (...keys: string[]) => keys.forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
}

export function useCreateJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { type: string; project_id: string; input: Record<string, unknown> }) =>
      post<{ id: string; estimate: { credits: number }; queue: string }>("/api/jobs", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["jobs"] });
      qc.invalidateQueries({ queryKey: ["balance"] });
    },
  });
}
