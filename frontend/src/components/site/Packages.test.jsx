import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { useReducedMotion } from "framer-motion";
import { Packages } from "./Packages";
import {
  COOKIE_CONSENT_STORAGE_KEY,
  COOKIE_CONSENT_UPDATED_EVENT,
  OPEN_COOKIE_SETTINGS_EVENT,
} from "./CookieConsent";
import useManagedContent from "@/hooks/useManagedContent";

jest.mock("@/hooks/useManagedContent");
jest.mock("framer-motion", () => ({ useReducedMotion: jest.fn(() => true) }));
jest.mock("@/components/site/ManagedPageMedia", () => () => null);

const items = [
  {
    id: "night-one", title: "Noapte unu", category: "Artificii de noapte",
    shortDescription: "Noapte", bestFor: "Evenimente", duration: "3 minute",
    highlights: [], cta: "Cere ofertă",
    videoUrl: "https://youtu.be/j2BGRd88qBc", moreVideoUrls: [],
  },
  {
    id: "day-one", title: "Zi unu", category: "Artificii de zi",
    shortDescription: "Zi", bestFor: "Ceremonii", duration: "2 minute",
    highlights: [], cta: "Cere ofertă",
    videoUrl: "https://youtu.be/O2nmBJeZNRY",
    moreVideoUrls: ["https://youtu.be/AWrMkTUn9iQ", "https://youtu.be/O2nmBJeZNRY"],
  },
];

let container;
let root;
const playlistButtons = () => [...container.querySelectorAll('[data-testid="package-video-playlist"] button')];
const player = () => container.querySelector('[data-testid="package-media"] iframe, [data-testid="package-media"] video');
const click = async (node) => { await act(async () => node.click()); };
const renderPackages = async (packages = items, route = "/pachete?categorie=Artificii%20de%20zi") => {
  await act(async () => root.render(
    <MemoryRouter initialEntries={[route]}><Packages items={packages} /></MemoryRouter>,
  ));
};
const setConsent = async (marketing, expiresAt = new Date(Date.now() + 86_400_000).toISOString()) => {
  const consent = { necessary: true, analytics: false, marketing, savedAt: new Date().toISOString(), expiresAt };
  window.localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, JSON.stringify(consent));
  await act(async () => window.dispatchEvent(new CustomEvent(COOKIE_CONSENT_UPDATED_EVENT, { detail: consent })));
};

beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  window.localStorage.clear();
  window.sessionStorage.clear();
  useManagedContent.mockImplementation((key, fallback) => fallback);
  useReducedMotion.mockReturnValue(true);
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  jest.useRealTimers();
  jest.restoreAllMocks();
  delete global.IS_REACT_ACT_ENVIRONMENT;
});

test("opens the requested category with every unique clip as a labelled thumbnail button and no outgoing video links", async () => {
  await renderPackages();
  expect(container.querySelector('[data-testid="packages-active-title"]').textContent).toBe("Zi unu");
  expect(playlistButtons()).toHaveLength(2);
  expect(playlistButtons().map((button) => button.querySelector("img").getAttribute("src"))).toEqual([
    "https://img.youtube.com/vi/O2nmBJeZNRY/hqdefault.jpg",
    "https://img.youtube.com/vi/AWrMkTUn9iQ/hqdefault.jpg",
  ]);
  expect(playlistButtons()[0].getAttribute("aria-pressed")).toBe("true");
  expect(playlistButtons()[1].getAttribute("aria-label")).toMatch(/Video 2.*Zi unu/);
  expect(container.querySelector('a[href*="youtu"]')).toBeNull();
  expect(player()).toBeNull();
});

test("clicking another thumbnail replaces the single inline player without a dialog or navigation", async () => {
  await setConsent(true);
  await renderPackages();
  expect(player()).toBeNull();
  await click(playlistButtons()[0]);
  expect(player().getAttribute("src")).toContain("/embed/O2nmBJeZNRY?");
  await click(playlistButtons()[1]);
  expect(player().getAttribute("src")).toContain("/embed/AWrMkTUn9iQ?");
  expect(player().getAttribute("title")).toContain("Zi unu");
  expect(container.querySelectorAll("iframe, video")).toHaveLength(1);
  expect(document.querySelector('[data-testid="package-video-dialog"]')).toBeNull();
  expect(playlistButtons().map((button) => button.getAttribute("aria-pressed"))).toEqual(["false", "true"]);
});

test("resets selection and stops playback when switching packages or categories, including returning to a package", async () => {
  await setConsent(true);
  await renderPackages([...items, { ...items[1], id: "day-two", title: "Zi doi" }]);
  await click(playlistButtons()[1]);
  await click(container.querySelectorAll("[data-variant-tile]")[1]);
  expect(player()).toBeNull();
  expect(playlistButtons()[0].getAttribute("aria-pressed")).toBe("true");
  await click(container.querySelectorAll("[data-variant-tile]")[0]);
  expect(playlistButtons()[0].getAttribute("aria-pressed")).toBe("true");
  await click(playlistButtons()[1]);
  await click(container.querySelectorAll(".nr-package-categories button")[0]);
  expect(player()).toBeNull();
  expect(playlistButtons()).toHaveLength(1);
  await click(container.querySelectorAll(".nr-package-categories button")[1]);
  expect(playlistButtons()[0].getAttribute("aria-pressed")).toBe("true");
});

test("stops the old clip immediately during an animated package transition", async () => {
  useReducedMotion.mockReturnValue(false);
  jest.useFakeTimers();
  await setConsent(true);
  await renderPackages([...items, { ...items[1], id: "day-two", title: "Zi doi" }]);
  await click(playlistButtons()[1]);
  expect(player().getAttribute("src")).toContain("autoplay=1");
  await click(container.querySelectorAll("[data-variant-tile]")[1]);
  expect(player()).toBeNull();
  await act(async () => jest.advanceTimersByTime(500));
  expect(container.querySelector('[data-testid="packages-active-title"]').textContent).toBe("Zi doi");
  expect(player()).toBeNull();
  expect(playlistButtons()[0].getAttribute("aria-pressed")).toBe("true");
});

test.each([false, true])("keeps embeds unloaded with missing or expired consent (expired: %s)", async (expired) => {
  if (expired) await setConsent(true, "2020-01-01T00:00:00.000Z");
  await renderPackages();
  await click(playlistButtons()[1]);
  expect(player()).toBeNull();
  expect(container.querySelector('[data-testid="package-media"] img').getAttribute("src")).toContain("AWrMkTUn9iQ");
  const openSettings = jest.fn();
  window.addEventListener(OPEN_COOKIE_SETTINGS_EVENT, openSettings);
  try {
    await click(container.querySelector(".nr-package-video-trigger"));
    expect(openSettings).toHaveBeenCalledTimes(1);
    expect(player()).toBeNull();
    await setConsent(true);
    expect(player()).toBeNull();
    await click(container.querySelector(".nr-package-video-trigger"));
    expect(player().getAttribute("src")).toContain("AWrMkTUn9iQ");
    await setConsent(false);
    expect(player()).toBeNull();
    await setConsent(true);
    expect(player()).toBeNull();
  } finally {
    window.removeEventListener(OPEN_COOKIE_SETTINGS_EVENT, openSettings);
  }
});

test("supports arrow, Home and End focus navigation without starting playback and disables autoplay for reduced motion", async () => {
  await setConsent(true);
  await renderPackages();
  const [first, second] = playlistButtons();
  first.focus();
  const press = async (node, key) => {
    await act(async () => node.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true })));
  };
  await press(first, "ArrowRight");
  expect(document.activeElement).toBe(second);
  expect(player()).toBeNull();
  await press(second, "Home");
  expect(document.activeElement).toBe(first);
  await press(first, "End");
  expect(document.activeElement).toBe(second);
  await press(second, "ArrowDown");
  expect(document.activeElement).toBe(first);
  await press(first, "ArrowLeft");
  expect(document.activeElement).toBe(second);
  await click(second);
  expect(player().getAttribute("src")).toContain("autoplay=0");
});

test("unloads a running YouTube player when consent expires without navigation", async () => {
  jest.useFakeTimers();
  await setConsent(true, new Date(Date.now() + 2000).toISOString());
  await renderPackages();
  await click(playlistButtons()[0]);
  expect(player()).not.toBeNull();
  await act(async () => jest.advanceTimersByTime(2001));
  expect(player()).toBeNull();
  expect(container.textContent).toContain("Activează videoclipul");
});

test("includes additional clips when the primary is blank and updates selection after a CMS edit", async () => {
  await setConsent(true);
  const managed = [{ ...items[1], videoUrl: "", moreVideoUrls: [" https://youtu.be/AWrMkTUn9iQ ", "https://youtu.be/j2BGRd88qBc"] }];
  useManagedContent.mockImplementation((key, fallback) => key === "packages" ? managed : fallback);
  await act(async () => root.render(<MemoryRouter><Packages /></MemoryRouter>));
  expect(playlistButtons()).toHaveLength(2);
  await click(playlistButtons()[1]);
  expect(player().getAttribute("src")).toContain("j2BGRd88qBc");
  managed[0] = { ...managed[0], moreVideoUrls: ["https://youtu.be/O2nmBJeZNRY"] };
  await act(async () => root.render(<MemoryRouter><Packages /></MemoryRouter>));
  expect(player()).toBeNull();
  expect(playlistButtons()).toHaveLength(1);
  expect(playlistButtons()[0].getAttribute("aria-pressed")).toBe("true");
});

test.each(["not a URL", "javascript:alert(1)", "https://notyoutube.com/watch?v=O2nmBJeZNRY", "https://youtu.be/missing", "https://example.com/not-a-video"])("keeps an invalid CMS video safe and visible with a fallback: %s", async (videoUrl) => {
  await setConsent(true);
  await renderPackages([{ ...items[1], videoUrl, moreVideoUrls: [] }]);
  expect(playlistButtons()).toHaveLength(1);
  await click(playlistButtons()[0]);
  expect(player()).toBeNull();
  expect(container.querySelector(".nr-package-video-trigger")).toBeNull();
  expect(container.textContent).toMatch(/indisponibil/i);
  expect(container.querySelector('[data-testid="package-media"] img').getAttribute("src")).not.toContain("img.youtube");
});

test("falls back from a broken thumbnail and poster without leaving broken images", async () => {
  await renderPackages();
  for (const selector of ['[data-testid="package-media"] img', '[data-testid="package-video-playlist"] button:first-child img']) {
    await act(async () => container.querySelector(selector).dispatchEvent(new Event("error")));
    expect(container.querySelector(selector).getAttribute("src")).not.toContain("img.youtube");
    await act(async () => container.querySelector(selector).dispatchEvent(new Event("error")));
    expect(container.querySelector(selector)).toBeNull();
  }
  expect(playlistButtons()[0].getAttribute("aria-label")).toContain("Zi unu");
});

test("plays local videos inline only on request and handles a failed media file gracefully", async () => {
  await renderPackages([{ ...items[1], videoUrl: "/media/package.mp4", moreVideoUrls: [] }]);
  expect(player()).toBeNull();
  await click(playlistButtons()[0]);
  expect(player().tagName).toBe("VIDEO");
  expect(player().getAttribute("src")).toBe("/media/package.mp4");
  expect(player().controls).toBe(true);
  expect(player().autoplay).toBe(false);
  await act(async () => player().dispatchEvent(new Event("error")));
  expect(player()).toBeNull();
  expect(container.textContent).toMatch(/indisponibil/i);
});

test("preserves the exact quote prefill after switching videos", async () => {
  await renderPackages();
  await click(playlistButtons()[1]);
  const originalLocation = window.location;
  delete window.location;
  window.location = { assign: jest.fn() };
  try {
    await click(container.querySelector('[data-testid="packages-direct-cta"]'));
    expect(JSON.parse(window.sessionStorage.getItem("fireartro-contact-prefill"))).toEqual({
      package_id: "day-one", package_title: "Zi unu", services: ["Artificii de zi"],
    });
    expect(window.location.assign).toHaveBeenCalledWith("/contact");
  } finally {
    window.location = originalLocation;
  }
});

test("keeps poster-only and empty catalogs usable", async () => {
  await renderPackages([{ ...items[1], videoUrl: "", moreVideoUrls: [] }]);
  expect(playlistButtons()).toHaveLength(0);
  expect(container.querySelector('[data-testid="package-media"] img')).not.toBeNull();
  expect(container.querySelector(".nr-package-video-trigger")).toBeNull();
  await renderPackages([]);
  expect(player()).toBeNull();
  expect(container.querySelector('[data-testid="packages-direct-cta"]')).toBeNull();
});

test("shows the public drone label without changing the internal category value", async () => {
  await renderPackages(items, "/pachete?categorie=Show%20drone");
  expect(container.querySelector('.nr-package-categories [aria-selected="true"]').textContent).toBe("Spectacole de drone");
  expect(container.querySelector('[data-testid="drone-show-quote"]')).not.toBeNull();
});
