export const ANALYTICS_EVENT = "fireartro-analytics-event";

// Return a category only; the destination, phone, email and message never
// become event parameters.
export function contactChannel(href) {
  if (typeof href !== "string") return null;
  try {
    const url = new URL(href, "https://fireart.ro");
    if (url.username || url.password) return null;
    if (url.protocol === "tel:" && url.pathname) return "phone";
    if (url.protocol === "mailto:" && url.pathname) return "email";
    if (url.protocol !== "https:") return null;
    if (url.hostname === "wa.me" && /^\/\d+\/?$/.test(url.pathname)) return "whatsapp";
    if (["api.whatsapp.com", "web.whatsapp.com"].includes(url.hostname)
        && /^\/send\/?$/.test(url.pathname)) return "whatsapp";
  } catch { /* Unsupported URLs do not participate in contact measurement. */ }
  return null;
}

const PUBLIC_PATHS = new Set([
  "/", "/pachete", "/galerie", "/intrebari-frecvente", "/contact", "/blog",
  "/confidentialitate", "/termeni-si-conditii", "/cookies",
  "/servicii/artificii-nunta", "/servicii/spectacole-drone",
  "/servicii/artificii-de-zi", "/servicii/efecte-speciale",
]);

export function pagePathForAnalytics(value) {
  if (typeof value !== "string") return null;
  const pathname = value.split(/[?#]/, 1)[0].replace(/\/$/, "") || "/";
  if (PUBLIC_PATHS.has(pathname)) return pathname;
  return /^\/blog\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(pathname) && pathname.length <= 206 ? pathname : null;
}

// Keep the referral domain (including AI referrals), without its private
// conversation path, search query, credentials or URL fragment.
export function referrerForAnalytics(value) {
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password ? `${url.origin}/` : "";
  } catch { return ""; }
}

// A local notification, consumed only by the consent-gated AnalyticsLoader.
// Intentionally accepts no quote payload or API response data.
export function trackQuoteAccepted() {
  if (typeof window === "undefined") return false;
  try {
    return window.dispatchEvent(new CustomEvent(ANALYTICS_EVENT, { detail: { name: "generate_lead" } }));
  } catch { return false; }
}
