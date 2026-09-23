/**
 * SPEC §22 — fails the build if any NEXT_PUBLIC_* variable looks like a secret, and greps the
 * client bundle for provider names that must never reach the browser.
 * Usage: pnpm check:public-env   (run after `next build` for the bundle scan)
 */
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";

const ALLOWED = new Set(["NEXT_PUBLIC_SUPABASE_ANON_KEY", "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY"]);
const SUSPICIOUS = /KEY|SECRET|TOKEN|PASSWORD/i;
const PROVIDER_MARKERS = ["api.openai.com", "queue.fal.run", "api.meshy.ai", "api.elevenlabs.io", "SUPABASE_SERVICE_ROLE_KEY", "sk_live_", "re_"];

let failed = false;

// 1. env names
const envFiles = [".env", ".env.local", ".env.production", ".env.example"].filter(existsSync);
for (const f of envFiles) {
  for (const line of readFileSync(f, "utf8").split(/\r?\n/)) {
    const m = line.match(/^(NEXT_PUBLIC_[A-Z0-9_]+)=/);
    if (m && SUSPICIOUS.test(m[1]) && !ALLOWED.has(m[1])) {
      console.error(`✗ ${f}: ${m[1]} looks like a secret exposed to the browser`);
      failed = true;
    }
  }
}
for (const key of Object.keys(process.env)) {
  if (key.startsWith("NEXT_PUBLIC_") && SUSPICIOUS.test(key) && !ALLOWED.has(key)) {
    console.error(`✗ process.env: ${key} looks like a secret exposed to the browser`);
    failed = true;
  }
}

// 2. client bundle scan
const staticDir = join(".next", "static");
if (existsSync(staticDir)) {
  const walk = (dir: string): string[] => readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : p.endsWith(".js") ? [p] : [];
  });
  for (const file of walk(staticDir)) {
    const src = readFileSync(file, "utf8");
    for (const marker of PROVIDER_MARKERS) {
      if (marker === "re_" ? /\bre_[A-Za-z0-9]{20,}/.test(src) : src.includes(marker)) {
        console.error(`✗ client bundle ${file} contains "${marker}"`);
        failed = true;
      }
    }
  }
} else {
  console.info("(no .next/static — bundle scan skipped; run after next build)");
}

if (failed) process.exit(1);
console.log("✓ public env check passed");
