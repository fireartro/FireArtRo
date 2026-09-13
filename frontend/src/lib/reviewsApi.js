const BACKEND_URL = (process.env.REACT_APP_BACKEND_URL || "").replace(/\/$/, "");
const REVIEWS_URL = `${BACKEND_URL}/api/reviews`;
const SUPPORTED_PROVIDERS = new Set(["google", "facebook"]);

const safeProviderUrl = (value, provider, photo = false) => {
  try {
    const url = new URL(String(value || "").trim());
    if (url.protocol !== "https:" || url.username || url.password || url.port) return "";
    const hosts = photo ? ["googleusercontent.com"]
      : provider === "google" ? ["google.com", "maps.app.goo.gl"] : ["facebook.com"];
    return hosts.some(host => url.hostname === host || url.hostname.endsWith(`.${host}`))
      ? url.href : "";
  } catch {
    return "";
  }
};

const normalizeProviders = (payload) => {
  if (!Array.isArray(payload?.providers)) return [];

  return payload.providers.flatMap((provider) => {
    const id = String(provider?.id || "").trim().toLowerCase();
    const href = safeProviderUrl(provider?.href, id);
    const reviews = Array.isArray(provider?.reviews)
      ? provider.reviews.filter((review) => String(review?.text || "").trim()).map(review => {
        const normalized = { ...review };
        for (const field of ["url", "author_url", "author_photo_url"]) {
          if (field in normalized) normalized[field] = safeProviderUrl(normalized[field], id, field === "author_photo_url");
        }
        return normalized;
      })
      : [];

    if (!SUPPORTED_PROVIDERS.has(id) || !href || !reviews.length) return [];
    return [{ ...provider, id, href, reviews }];
  });
};


export async function getPublicReviews({ signal } = {}) {
  try {
    const response = await fetch(REVIEWS_URL, {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal,
    });
    if (!response.ok) return [];
    return normalizeProviders(await response.json());
  } catch {
    return [];
  }
}

export { normalizeProviders };
