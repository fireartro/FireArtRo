import { getPublicReviews } from "./reviewsApi";


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
    { headers: { Accept: "application/json" }, signal: undefined },
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
    { headers: { Accept: "application/json" }, signal: controller.signal },
  );
});
