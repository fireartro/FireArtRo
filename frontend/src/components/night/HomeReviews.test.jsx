import { act } from "react";
import { createRoot } from "react-dom/client";
import { DraftPreviewProvider, PublishedContentSnapshotProvider } from "@/content/ManagedContentProvider";
import { CMS_DEFAULTS } from "@/data/cmsDefaults";
import { COOKIE_CONSENT_STORAGE_KEY, OPEN_COOKIE_SETTINGS_EVENT } from "@/lib/cookieConsent";
import { seedConsent } from "@/lib/consentTestFixture";
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
  window.localStorage.removeItem(COOKIE_CONSENT_STORAGE_KEY);
  delete global.IS_REACT_ACT_ENVIRONMENT;
});
const render = async (settings = {}) => act(async () => root.render(
  <PublishedContentSnapshotProvider content={{ ...CMS_DEFAULTS, reviewSettings: {
    ...CMS_DEFAULTS.reviewSettings, ...settings,
  } }}><HomeReviews /></PublishedContentSnapshotProvider>,
));

const expectFacebookReviewLink = () => {
  const link = container.querySelector("[data-review-provider='facebook'] .fa-page-reviews__lane-head a");
  expect(link.textContent).toBe("Adaugă recenzie");
  expect(link.href).toBe("https://www.facebook.com/FireArtRo/reviews");
  expect(link.target).toBe("_blank");
  expect(link.relList.contains("noopener")).toBe(true);
  expect(link.relList.contains("noreferrer")).toBe(true);
  expect(link.getAttribute("aria-label")).toMatch(/Facebook.*filă nouă/);
};

test("links to Google Maps and cookie settings without displaying review cards or loading avatars before consent", async () => {
  const onSettings = jest.fn();
  window.addEventListener(OPEN_COOKIE_SETTINGS_EVENT, onSettings, { once: true });
  await render();
  expect(container.querySelector("[data-review-card]")).toBeNull();
  expect(container.querySelector("a[href='https://maps.google.com/?cid=123']")).not.toBeNull();
  expect(container.querySelector(`img[src='${review.author_photo_url}']`)).toBeNull();
  expect(container.textContent).not.toContain("FireArtRo nu verifică independent");
  expect(container.querySelector("a[href='/termeni-si-conditii#terms-section-8']").textContent).toBe("Sursă și verificare");
  await act(async () => container.querySelector("[data-review-provider='google'] button").click());
  expect(onSettings).toHaveBeenCalledTimes(1);
});

test("preserves Google Maps author attribution and source links only while external content is authorized", async () => {
  seedConsent({ analytics: false, marketing: true });
  await render();
  const card = container.querySelector("[data-review-card]");
  expect(container.querySelector("[data-review-provider='google'] h2").textContent).toBe("Recenzii de pe Google Maps");
  expect(card.querySelector("blockquote").contains(card.querySelector("footer"))).toBe(false);
  expect(card.querySelector("[aria-label='5 din 5 stele']").children).toHaveLength(5);
  expect(card.querySelector(`a[href='${review.url}']`)).not.toBeNull();
  expect(card.querySelector(`a[href='${review.author_url}']`).textContent).toContain("Ana M.");
  expect(card.querySelector("img").getAttribute("src")).toBe(review.author_photo_url);
  expect(container.querySelector("img[alt='Google Maps']")).not.toBeNull();
  expect(container.textContent).toMatch(/relevanță/);
  expect(container.textContent).not.toMatch(/verificate/);
  expect(container.querySelectorAll("[aria-hidden='true'] a:not([tabindex='-1'])")).toHaveLength(0);
  await act(async () => seedConsent({ analytics: false, marketing: false }));
  expect(container.querySelector("[data-review-card]")).toBeNull();
  expect(container.querySelector(`img[src='${review.author_photo_url}']`)).toBeNull();
});

test("provider failure hides the section when the Facebook fallback is disabled", async () => {
  global.fetch.mockResolvedValue({ ok: false });
  await render({ facebookEnabled: false });
  expect(container.querySelector("[data-testid='home-reviews']")).toBeNull();
});

test("loads the live Facebook widget only with current external-content consent", async () => {
  global.fetch.mockResolvedValue({ ok: true, json: async () => ({ providers: [] }) });
  const prior = seedConsent({ marketing: true });
  window.localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, JSON.stringify({ ...prior, version: 3 }));
  await render();
  expect(container.querySelector("iframe")).toBeNull();
  const fallback = container.querySelector("[data-review-provider='facebook'] .fa-page-reviews__notice a");
  expect(fallback.textContent.trim()).toBe("Vezi recenziile pe Facebook");
  expect(fallback.href).toBe("https://www.facebook.com/FireArtRo/reviews");
  expectFacebookReviewLink();

  await act(async () => seedConsent({ marketing: true }));
  expect(container.querySelector("iframe[title='Recenzii FireArtRo de pe Facebook']").getAttribute("src"))
    .toMatch(/^https:\/\/[a-f0-9]{32}\.elf\.site\/?$/);
  expect(container.querySelector("iframe").getAttribute("loading")).toBe("eager");
  expectFacebookReviewLink();

  await act(async () => seedConsent());
  expect(container.querySelector("iframe")).toBeNull();
  expectFacebookReviewLink();
});

test("disabled settings do not request external review data", async () => {
  await render({ enabled: false });
  expect(global.fetch).not.toHaveBeenCalled();
  expect(container.textContent).toBe("");
});

test("legacy Facebook API cards cannot replace the consent-gated widget", async () => {
  global.fetch.mockResolvedValue({ ok: true, json: async () => ({ providers: [{
    id: "facebook", href: "https://www.facebook.com/FireArtRo",
    reviews: [{ ...review, provider: "facebook", url: "https://www.facebook.com/review/123", author_url: "", author_photo_url: "" }],
  }] }) });
  await render();
  expectFacebookReviewLink();
  expect(container.querySelector("[data-review-card]")).toBeNull();
  expect(container.querySelector("iframe")).toBeNull();
  await act(async () => seedConsent({ marketing: true }));
  expect(container.querySelector("iframe[title='Recenzii FireArtRo de pe Facebook']")).not.toBeNull();
  expect(container.querySelector("[data-review-card]")).toBeNull();
});

test("enabling Facebook alone does not request reviews from the server", async () => {
  seedConsent({ marketing: true });
  await render({ googleEnabled: false });
  expectFacebookReviewLink();
  expect(container.querySelector("iframe")).not.toBeNull();
  expect(global.fetch).not.toHaveBeenCalled();
});

test("shows enabled sources in the authenticated draft preview without loading external reviews", async () => {
  seedConsent({ analytics: false, marketing: true });
  await act(async () => root.render(<DraftPreviewProvider content={CMS_DEFAULTS}><HomeReviews /></DraftPreviewProvider>));
  expect(container.textContent).toContain("Google, Facebook");
  expect(global.fetch).not.toHaveBeenCalled();
  expect(container.querySelector("iframe")).toBeNull();
});

test("starts the permitted Facebook widget without waiting for a viewport intersection", async () => {
  const priorObserver = global.IntersectionObserver;
  const observe = jest.fn();
  const intersections = new Map();
  global.IntersectionObserver = jest.fn((callback, options) => {
    intersections.set(options.rootMargin, callback);
    return { observe, disconnect: jest.fn() };
  });
  try {
    seedConsent({ marketing: true });
    await render({ enabled: false });
    expect(observe).not.toHaveBeenCalled();
    await render();
    expect(global.IntersectionObserver).toHaveBeenCalledTimes(1);
    expect(observe).toHaveBeenCalledWith(container.querySelector("#recenzii"));
    expect(container.querySelector("iframe")).not.toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
    await act(async () => intersections.get("300px")([{ isIntersecting: true }]));
    expect(global.fetch).toHaveBeenCalledTimes(1);
  } finally {
    global.IntersectionObserver = priorObserver;
  }
});
