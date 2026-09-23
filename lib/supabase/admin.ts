import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import { env } from "@/lib/env";

export type AdminClient = SupabaseClient<Database>;

let cached: AdminClient | null = null;

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

/**
 * Service-role client (bypasses RLS). SPEC §22: imported only from server code.
 * Every write to financial tables (credit_*, jobs, assets) goes through this client.
 */
export function supabaseAdmin(): AdminClient {
  if (cached) return cached;
  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new ConfigError(
      "SUPABASE_SERVICE_ROLE_KEY is not set. Copy it from Supabase → Project Settings → API Keys into .env.local.",
    );
  }
  cached = createClient<Database>(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return cached;
}
