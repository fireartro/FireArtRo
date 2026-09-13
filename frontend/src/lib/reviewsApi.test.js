import { getPublicReviews, normalizeProviders } from "./reviewsApi";


const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
  jest.restoreAllMocks();
});

test("returns only configured providers containing real review text", async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({
      providers: [
        {
          id: "google",
          href: "https://maps.google.com/?cid=fireartro",
          reviews: [
            { id: "g1", provider: "google", author: "Ana", text: "Excelent.", rating: 5 },
            { id: "g2", provider: "google", author: "Gol", text: "   ", rating: 5 },
          ],
        },
        { id: "facebook", href: "", reviews: [{ id: "f1", text: "Bun." }] },
        { id: "unknown", href: "https://example.com", reviews: [{ id: "x1", text: "Nu." }] },
      ],
    }),
  });

  await expect(getPublicReviews()).resolves.toEqual([
    {
      id: "google",
      href: "https://maps.google.com/?cid=fireartro",
      reviews: [
        { id: "g1", provider: "google", author: "Ana", text: "Excelent.", rating: 5 },
      ],
    },
  ]);
  expect(global.fetch).toHaveBeenCalledWith(
    "/api/reviews",
    { headers: { Accept: "application/json" }, cache: "no-store", signal: undefined },
  );
});

test("returns an empty collection for failed or malformed provider responses", async () => {
  global.fetch = jest.fn()
    .mockResolvedValueOnce({ ok: false, status: 503, json: async () => ({}) })
    .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ providers: "invalid" }) });

  await expect(getPublicReviews()).resolves.toEqual([]);
  await expect(getPublicReviews()).resolves.toEqual([]);
});

test("passes an abort signal to the reviews request", async () => {
  const controller = new AbortController();
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ providers: [] }),
  });

  await getPublicReviews({ signal: controller.signal });

  expect(global.fetch).toHaveBeenCalledWith(
    "/api/reviews",
    { headers: { Accept: "application/json" }, cache: "no-store", signal: controller.signal },
  );
});

test("drops unsafe provider destinations and strips unsafe attribution URLs", () => {
  expect(normalizeProviders({ providers: [{
    id: "google", href: "javascript:alert(1)", reviews: [{ text: "Review" }],
  }] })).toEqual([]);
  const [provider] = normalizeProviders({ providers: [{
    id: "google", href: "https://maps.google.com/?cid=123", reviews: [{
      id: "g1", text: "Review", url: "https://google.com.evil.test/review",
      author_url: "javascript:alert(1)", author_photo_url: "https://tracker.test/photo",
    }],
  }] });
  expect(provider.reviews[0]).toMatchObject({ url: "", author_url: "", author_photo_url: "" });
});

test("preserves Google review and author attribution destinations", () => {
  const review = {
    text: "Review", url: "https://www.google.com/maps/reviews/123",
    author_url: "https://www.google.com/maps/contrib/456",
    author_photo_url: "https://lh3.googleusercontent.com/photo",
  };
  expect(normalizeProviders({ providers: [{
    id: "google", href: "https://maps.google.com/?cid=123", reviews: [review],
  }] })[0].reviews[0]).toEqual(review);
});
