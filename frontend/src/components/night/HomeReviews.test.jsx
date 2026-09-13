import { act } from "react";
import { createRoot } from "react-dom/client";
import { DraftPreviewProvider } from "@/content/ManagedContentProvider";
import { CMS_DEFAULTS } from "@/data/cmsDefaults";
import HomeReviews from "./HomeReviews";

const review = {
  id: "review-1", author: "Ana M.", text: "Un spectacol frumos.", rating: 5,
  published_at: "2026-08-20T18:30:00Z",
  url: "https://www.google.com/maps/reviews/review-1",
  author_url: "https://www.google.com/maps/contrib/ana",
  author_photo_url: "https://lh3.googleusercontent.com/ana",
};
const originalFetch = global.fetch;
let container;
let root;
beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ providers: [{
    id: "google", href: "https://maps.google.com/?cid=123", reviews: [review],
  }] }) });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  global.fetch = originalFetch;
  delete global.IS_REACT_ACT_ENVIRONMENT;
});
const render = async (settings = {}) => act(async () => root.render(
  <DraftPreviewProvider content={{ ...CMS_DEFAULTS, reviewSettings: {
    ...CMS_DEFAULTS.reviewSettings, ...settings,
  } }}><HomeReviews /></DraftPreviewProvider>,
));

test("credits Google Maps and provides author, avatar and individual review links", async () => {
  await render();
  const card = container.querySelector("[data-review-card]");
  expect(card.querySelector(`a[href='${review.url}']`)).not.toBeNull();
  expect(card.querySelector(`a[href='${review.author_url}']`).textContent).toContain("Ana M.");
  expect(card.querySelector("img").getAttribute("src")).toBe(review.author_photo_url);
  expect(container.querySelector("img[alt='Google Maps']")).not.toBeNull();
  expect(container.textContent).toMatch(/relevanță/);
  expect(container.textContent).not.toMatch(/verificate/);
  expect(container.querySelectorAll("[aria-hidden='true'] a:not([tabindex='-1'])")).toHaveLength(0);
});

test("provider failure hides the section without inventing reviews", async () => {
  global.fetch.mockResolvedValue({ ok: false });
  await render();
  expect(container.querySelector("[data-testid='home-reviews']")).toBeNull();
});

test("disabled settings do not request external review data", async () => {
  await render({ enabled: false });
  expect(global.fetch).not.toHaveBeenCalled();
  expect(container.textContent).toBe("");
});
