const BACKEND_URL = (process.env.REACT_APP_BACKEND_URL || "").replace(/\/$/, "");
const REVIEWS_URL = `${BACKEND_URL}/api/reviews`;
const SUPPORTED_PROVIDERS = new Set(["google", "facebook"]);


const normalizeProviders = (payload) => {
  if (!Array.isArray(payload?.providers)) return [];

  return payload.providers.flatMap((provider) => {
    const id = String(provider?.id || "").trim().toLowerCase();
    const href = String(provider?.href || "").trim();
    const reviews = Array.isArray(provider?.reviews)
      ? provider.reviews.filter((review) => String(review?.text || "").trim())
      : [];

    if (!SUPPORTED_PROVIDERS.has(id) || !href || !reviews.length) return [];
    return [{ ...provider, id, href, reviews }];
  });
};


export async function getPublicReviews({ signal } = {}) {
  try {
    const response = await fetch(REVIEWS_URL, {
      headers: { Accept: "application/json" },
      signal,
    });
    if (!response.ok) return [];
    return normalizeProviders(await response.json());
  } catch {
    return [];
  }
}

export { normalizeProviders };
