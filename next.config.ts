import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";
const supabaseHost = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://example.supabase.co").host;
  } catch {
    return "*.supabase.co";
  }
})();

// SPEC §22 — security headers. CSP is report-friendly in dev (Next dev needs eval/inline).
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isProd ? "" : " 'unsafe-eval'"} https://js.stripe.com`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.r2.cloudflarestorage.com",
  "media-src 'self' blob: https://*.r2.cloudflarestorage.com",
  `connect-src 'self' https://${supabaseHost} wss://${supabaseHost} https://api.stripe.com https://*.r2.cloudflarestorage.com${isProd ? "" : " ws://localhost:* http://localhost:*"}`,
  "frame-src https://js.stripe.com https://checkout.stripe.com",
  "font-src 'self' data:",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self' https://checkout.stripe.com https://billing.stripe.com",
  "frame-ancestors 'none'",
].join("; ");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["sharp"],
  experimental: { serverActions: { bodySizeLimit: "12mb" } },
  images: { remotePatterns: [{ protocol: "https", hostname: "*.r2.cloudflarestorage.com" }] },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
          { key: "X-Frame-Options", value: "DENY" },
          ...(isProd ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }] : []),
        ],
      },
    ];
  },
};

export default nextConfig;
