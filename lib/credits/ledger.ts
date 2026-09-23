import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/database.types";

type Bucket = Database["public"]["Enums"]["credit_bucket"];
type LedgerKind = Database["public"]["Enums"]["ledger_kind"];

/** Thin wrappers over the SECURITY DEFINER RPCs (SPEC §11.7). Service role only. */

export async function reserveCredits(workspaceId: string, jobId: string, amount: number): Promise<boolean> {
  const { data, error } = await supabaseAdmin().rpc("reserve_credits", {
    p_workspace: workspaceId,
    p_job: jobId,
    p_amount: amount,
  });
  if (error) throw error;
  return data === true;
}

export async function releaseReservation(jobId: string) {
  const { error } = await supabaseAdmin().rpc("release_reservation", { p_job: jobId });
  if (error) throw error;
}

export async function settleJobCredits(jobId: string, actual: number): Promise<number> {
  const { data, error } = await supabaseAdmin().rpc("settle_job_credits", { p_job: jobId, p_actual: actual });
  if (error) throw error;
  return data ?? 0;
}

export async function grantCredits(opts: {
  workspaceId: string;
  bucket: Bucket;
  amount: number;
  kind: LedgerKind;
  ref?: string | null;
  expiresAt?: Date | null;
  actorId?: string | null;
  description?: string | null;
}): Promise<boolean> {
  const { data, error } = await supabaseAdmin().rpc("grant_credits", {
    p_workspace: opts.workspaceId,
    p_bucket: opts.bucket,
    p_amount: opts.amount,
    p_kind: opts.kind,
    p_ref: opts.ref ?? undefined,
    p_expires_at: opts.expiresAt ? opts.expiresAt.toISOString() : undefined,
    p_actor: opts.actorId ?? undefined,
    p_description: opts.description ?? undefined,
  });
  if (error) throw error;
  return data === true;
}

export async function resetSubscriptionCredits(workspaceId: string, amount: number, expiresAt: Date, ref?: string) {
  const { data, error } = await supabaseAdmin().rpc("reset_subscription_credits", {
    p_workspace: workspaceId,
    p_amount: amount,
    p_expires_at: expiresAt.toISOString(),
    p_ref: ref,
  });
  if (error) throw error;
  return data === true;
}

export async function expireCredits(workspaceId: string, bucket: Bucket): Promise<number> {
  const { data, error } = await supabaseAdmin().rpc("expire_credits", { p_workspace: workspaceId, p_bucket: bucket });
  if (error) throw error;
  return data ?? 0;
}

export async function setSubscriptionExpiry(workspaceId: string, expiresAt: Date | null) {
  const { error } = await supabaseAdmin().rpc("set_subscription_expiry", {
    p_workspace: workspaceId,
    p_expires_at: expiresAt ? expiresAt.toISOString() : (null as unknown as string),
  });
  if (error) throw error;
}

export async function adjustStorage(workspaceId: string, deltaBytes: number): Promise<number> {
  const { data, error } = await supabaseAdmin().rpc("adjust_storage", {
    p_workspace: workspaceId,
    p_delta: deltaBytes,
  });
  if (error) throw error;
  return data ?? 0;
}

export interface BalanceView {
  trial_available: number;
  trial_expires_at: string | null;
  subscription_available: number;
  subscription_expires_at: string | null;
  purchased_available: number;
  reserved: number;
  available: number;
}

export async function getBalance(workspaceId: string): Promise<BalanceView> {
  const { data, error } = await supabaseAdmin()
    .from("credit_balances")
    .select("*")
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    return {
      trial_available: 0,
      trial_expires_at: null,
      subscription_available: 0,
      subscription_expires_at: null,
      purchased_available: 0,
      reserved: 0,
      available: 0,
    };
  }
  const now = Date.now();
  const trial = !data.trial_expires_at || new Date(data.trial_expires_at).getTime() > now ? data.trial_available : 0;
  const sub =
    !data.subscription_expires_at || new Date(data.subscription_expires_at).getTime() > now
      ? data.subscription_available
      : 0;
  return {
    trial_available: trial,
    trial_expires_at: data.trial_expires_at,
    subscription_available: sub,
    subscription_expires_at: data.subscription_expires_at,
    purchased_available: data.purchased_available,
    reserved: data.reserved,
    available: trial + sub + data.purchased_available - data.reserved,
  };
}
