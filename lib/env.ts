/**
 * Server-side environment access (SPEC §24). Never import from client components.
 * Values are read lazily so that missing optional integrations degrade gracefully in local dev.
 */
function str(name: string, fallback = ""): string {
  const v = process.env[name];
  return v === undefined || v === "" ? fallback : v;
}

export const env = {
  get APP_URL() {
    return str("APP_URL", str("NEXT_PUBLIC_APP_URL", "http://localhost:3000")).replace(/\/$/, "");
  },
  get SUPABASE_URL() {
    return str("NEXT_PUBLIC_SUPABASE_URL");
  },
  get SUPABASE_ANON_KEY() {
    return str("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  },
  get SUPABASE_SERVICE_ROLE_KEY() {
    return str("SUPABASE_SERVICE_ROLE_KEY");
  },
  get AUTH_CODE_PEPPER() {
    return str("AUTH_CODE_PEPPER", "dev-pepper-change-me");
  },
  get TOS_VERSION() {
    return str("TOS_VERSION", "2026-09-20");
  },
  get SUPPORT_EMAIL() {
    return str("SUPPORT_EMAIL", "support@veyraflow.eu");
  },
  get TRIAL_CREDITS() {
    return Number(str("TRIAL_CREDITS", "86"));
  },
  get MOCK_PROVIDERS() {
    return str("MOCK_PROVIDERS", "false") === "true";
  },
  get OPENAI_API_KEY() {
    return str("OPENAI_API_KEY");
  },
  get PROMPT_TRANSLATOR_MODEL() {
    return str("PROMPT_TRANSLATOR_MODEL", "gpt-5.6-luna");
  },
  get MODERATION_MODEL() {
    return str("MODERATION_MODEL", "gpt-5-nano");
  },
  get FAL_KEY() {
    return str("FAL_KEY");
  },
  get R2_ACCOUNT_ID() {
    return str("R2_ACCOUNT_ID");
  },
  get R2_ACCESS_KEY_ID() {
    return str("R2_ACCESS_KEY_ID");
  },
  get R2_SECRET_ACCESS_KEY() {
    return str("R2_SECRET_ACCESS_KEY");
  },
  get R2_BUCKET() {
    return str("R2_BUCKET", "veyraflow-assets");
  },
  get R2_ENDPOINT() {
    const e = str("R2_ENDPOINT");
    if (e) return e;
    const acc = str("R2_ACCOUNT_ID");
    return acc ? `https://${acc}.r2.cloudflarestorage.com` : "";
  },
  get STRIPE_SECRET_KEY() {
    return str("STRIPE_SECRET_KEY");
  },
  get STRIPE_WEBHOOK_SECRET() {
    return str("STRIPE_WEBHOOK_SECRET");
  },
  get STRIPE_PRICES() {
    return {
      trial: str("STRIPE_PRICE_TRIAL"),
      pro: str("STRIPE_PRICE_PRO_MONTHLY"),
      studio: str("STRIPE_PRICE_STUDIO_MONTHLY"),
      pack_1000: str("STRIPE_PRICE_PACK_1000"),
      pack_10000: str("STRIPE_PRICE_PACK_10000"),
    };
  },
  get RESEND_API_KEY() {
    return str("RESEND_API_KEY");
  },
  get EMAIL_FROM() {
    return str("EMAIL_FROM", "Veyraflow <website@veyraflow.eu>").replace(/^"|"$/g, "");
  },
  get INNGEST_EVENT_KEY() {
    return str("INNGEST_EVENT_KEY");
  },
  get INNGEST_SIGNING_KEY() {
    return str("INNGEST_SIGNING_KEY");
  },
  get MODAL_WORKER_URL() {
    return str("MODAL_WORKER_URL").replace(/\/$/, "");
  },
  get MODAL_WORKER_TOKEN() {
    return str("MODAL_WORKER_TOKEN");
  },
  get WORKER_WEBHOOK_SECRET() {
    return str("WORKER_WEBHOOK_SECRET");
  },
  get FAL_WEBHOOK_SECRET() {
    return str("FAL_WEBHOOK_SECRET");
  },
  get GCP_PROJECT_ID() {
    return str("GCP_PROJECT_ID");
  },
  get GCP_ERROR_REPORTING_API_KEY() {
    return str("GCP_ERROR_REPORTING_API_KEY");
  },
  get IS_DEV() {
    return process.env.NODE_ENV !== "production";
  },
};

/** Which integrations are configured. Drives graceful fallbacks in local development. */
export const integrations = {
  get supabaseAdmin() {
    return Boolean(env.SUPABASE_SERVICE_ROLE_KEY);
  },
  get r2() {
    return Boolean(env.R2_ACCESS_KEY_ID && env.R2_SECRET_ACCESS_KEY && env.R2_ENDPOINT);
  },
  get stripe() {
    return Boolean(env.STRIPE_SECRET_KEY);
  },
  get resend() {
    return Boolean(env.RESEND_API_KEY);
  },
  get inngest() {
    return Boolean(env.INNGEST_EVENT_KEY);
  },
  get worker() {
    return Boolean(env.MODAL_WORKER_URL && env.MODAL_WORKER_TOKEN);
  },
  /** Google Cloud Error Reporting (SPEC §25.4) — without it errors only go to the server console. */
  get errorReporting() {
    return Boolean(env.GCP_PROJECT_ID && env.GCP_ERROR_REPORTING_API_KEY);
  },
  /**
   * Mock AI providers when explicitly requested or when no provider key exists at all. Per stage:
   * generation needs FAL_KEY, translation/moderation need OPENAI_API_KEY (SPEC §9.7, §8.3).
   */
  get mockProviders() {
    return env.MOCK_PROVIDERS || !(env.OPENAI_API_KEY || env.FAL_KEY);
  },
};
