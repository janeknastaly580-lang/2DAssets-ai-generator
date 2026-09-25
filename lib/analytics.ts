/**
 * SPEC §21.6 — Google Analytics 4 via gtag.js. Loaded only after `analytics` consent (§21.3) and only
 * when NEXT_PUBLIC_GA_MEASUREMENT_ID is set; otherwise every export is a no-op.
 *
 * Page views are sent manually with a sanitized URL (the GA4 stream must have "Page changes based on
 * browser history events" OFF): share/invite tokens and IDs in paths are replaced with `[id]` and the
 * query string is dropped (it carries e-mails on /verify and /reset-password), except utm_* params.
 */
type Gtag = (...args: unknown[]) => void;
type Params = Record<string, string | number | boolean | undefined>;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: Gtag;
  }
}

export const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID ?? "";

const KEEP_PARAM = /^utm_(source|medium|campaign|term|content)$/;
// UUIDs and long random tokens (share links: 43-char base64url, invites: hex) — never real route names.
const ID_SEGMENT = /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|[A-Za-z0-9_-]{20,})$/i;

let loaded = false;
let enabled = false;
let lastLocation: string | undefined;

export function sanitizeUrl(href: string): string {
  const url = new URL(href);
  const path = url.pathname
    .split("/")
    .map((s) => (ID_SEGMENT.test(s) ? "[id]" : s))
    .join("/");
  const kept = [...url.searchParams].filter(([k]) => KEEP_PARAM.test(k));
  const query = kept.length ? `?${new URLSearchParams(kept)}` : "";
  return `${url.origin}${path}${query}`;
}

function initialReferrer(): string | undefined {
  const ref = document.referrer;
  if (!ref) return undefined;
  try {
    return new URL(ref).origin === location.origin ? sanitizeUrl(ref) : ref;
  } catch {
    return undefined;
  }
}

function ensureGtag(): Gtag {
  window.dataLayer = window.dataLayer ?? [];
  if (!window.gtag) {
    window.gtag = function gtag() {
      // gtag.js only understands the `arguments` object, not a plain array
      // eslint-disable-next-line prefer-rest-params
      window.dataLayer!.push(arguments);
    };
  }
  return window.gtag;
}

function setDisabledFlag(disabled: boolean) {
  (window as unknown as Record<string, boolean>)[`ga-disable-${GA_ID}`] = disabled;
}

/** GA cookies (`_ga`, `_ga_<stream>`) live on the host or a parent domain — try every candidate. */
function deleteGaCookies() {
  const names = document.cookie
    .split("; ")
    .map((c) => c.split("=")[0])
    .filter((n) => n === "_ga" || n.startsWith("_ga_") || n === "_gid");
  const parts = location.hostname.split(".");
  const domains = [""];
  for (let i = 0; i < parts.length - 1; i++) domains.push(`; domain=.${parts.slice(i).join(".")}`);
  for (const name of names) for (const d of domains) document.cookie = `${name}=; Max-Age=0; Path=/${d}`;
}

/** Called when analytics consent is (or already was) granted. Injects gtag.js once. */
export function enableAnalytics() {
  if (!GA_ID || typeof window === "undefined" || enabled) return;
  const gtag = ensureGtag();
  setDisabledFlag(false);
  if (!loaded) {
    loaded = true;
    gtag("consent", "default", { ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied", analytics_storage: "granted" });
    gtag("set", { page_location: sanitizeUrl(location.href), page_referrer: initialReferrer() });
    gtag("js", new Date());
    gtag("config", GA_ID, { send_page_view: false, allow_google_signals: false, allow_ad_personalization_signals: false });
    const script = document.createElement("script");
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA_ID)}`;
    document.head.appendChild(script);
  } else {
    gtag("consent", "update", { analytics_storage: "granted" });
  }
  enabled = true;
  lastLocation = undefined;
  trackPageView();
}

/** Called when analytics consent is withdrawn: stop sending and remove GA cookies. */
export function disableAnalytics() {
  if (!GA_ID || typeof window === "undefined") return;
  if (loaded) ensureGtag()("consent", "update", { analytics_storage: "denied" });
  setDisabledFlag(true);
  enabled = false;
  deleteGaCookies();
}

/** Sends a page_view for the current URL (deduplicated — safe to call on every route change). */
export function trackPageView() {
  if (!enabled) return;
  const page_location = sanitizeUrl(location.href);
  if (page_location === lastLocation) return;
  const page_referrer = lastLocation ?? initialReferrer();
  lastLocation = page_location;
  const gtag = ensureGtag();
  // `set` makes every later event (incl. automatic user_engagement / scroll) carry the clean URL
  gtag("set", { page_location, page_referrer, page_title: document.title });
  gtag("event", "page_view", { page_location, page_referrer, page_title: document.title });
}

/**
 * Custom / recommended GA4 event. Never pass PII (e-mails, names, prompts) or URLs with tokens —
 * only enums, counts and IDs from our own catalogue.
 */
export function track(name: string, params: Params = {}) {
  if (!enabled) return;
  ensureGtag()("event", name, { ...params, page_location: sanitizeUrl(location.href) });
}
