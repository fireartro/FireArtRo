import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { DraftPreviewProvider } from "@/content/ManagedContentProvider";
import { CMS_DEFAULTS } from "@/data/cmsDefaults";
import HomePartners from "./HomePartners";
import { useReducedMotion } from "framer-motion";

jest.mock("framer-motion", () => ({ useReducedMotion: jest.fn(() => true) }));
jest.mock("gsap", () => ({ gsap: { registerPlugin: jest.fn() } }));
jest.mock("gsap/ScrollTrigger", () => ({ ScrollTrigger: {} }));

let container;
let root;
beforeEach(() => {
  useReducedMotion.mockReturnValue(true);
  global.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  delete global.IS_REACT_ACT_ENVIRONMENT;
});
const render = async (patch = {}) => act(async () => root.render(
  <MemoryRouter><DraftPreviewProvider content={{ ...CMS_DEFAULTS, ...patch }}><HomePartners /></DraftPreviewProvider></MemoryRouter>,
));
const names = () => [...container.querySelectorAll("[data-partner-name]")].map(el => el.textContent);

test("replaces only the original empty partner seed with the owner's real collaborations", async () => {
  await render();
  expect(names()).toHaveLength(26);
  expect(names()).toEqual(expect.arrayContaining(["Restaurant Capricci", "Primăria Seini", "Infinity Ballroom", "Colț de Rai", "Palat Ioan Festeleu"]));
  expect(container.textContent).not.toContain("PARTENER 01");
  expect(container.querySelector('img[src="/media/partners/shopping-city-satu-mare.png"]')).not.toBeNull();
});

test("honors an intentionally empty published list without restoring deleted partners", async () => {
  await render({ partners: [] });
  expect(names()).toHaveLength(0);
});

test("does not migrate the original list after an Admin placeholder-only edit", async () => {
  const partners = CMS_DEFAULTS.partners.map((partner, index) => index ? partner : { ...partner, logoPlaceholder: "Sigla locației" });
  await render({ partners });
  expect(names()).toHaveLength(12);
  expect(names()[0]).toBe("PARTENER 01");
});

test("keeps the dark backing for an official white logo selected through Admin", async () => {
  await render({
    partners: [{ id: "aquastar", name: "AquaStar", logoMediaId: "selected" }],
    mediaItems: [{ id: "selected", type: "image", src: "/media/partners/aquastar.png" }],
  });
  expect(container.querySelector(".fa-partner__mark").dataset.theme).toBe("dark");
});

test("uses a neutral backing for an unknown uploaded logo", async () => {
  await render({
    partners: [{ id: "brand", name: "Brand real", logoMediaId: "selected" }],
    mediaItems: [{ id: "selected", type: "image", src: "/owned/white-brand.svg" }],
  });
  expect(container.querySelector(".fa-partner__mark").dataset.theme).toBe("neutral");
});

test("preserves an unknown partner whose uploaded logo has been deleted", async () => {
  await render({ partners: [{ id: "brand", name: "Brand real", logoMediaId: "deleted" }], mediaItems: [] });
  expect(names()).toEqual(["Brand real"]);
  expect(container.querySelector("img")).toBeNull();
});

test("preserves CMS list, copy and uploaded logo over any catalogue match", async () => {
  await render({
    partners: [{ id: "owner", name: "Dedeman", logoMediaId: "uploaded", replaceable: false }],
    mediaItems: [{ id: "uploaded", type: "image", src: "/owned/new-dedeman.svg" }],
    homePage: { ...CMS_DEFAULTS.homePage, partners: { ...CMS_DEFAULTS.homePage.partners, title: "Colaborările noastre" } },
  });
  expect(names()).toEqual(["Dedeman"]);
  expect(container.querySelector("h2").textContent).toBe("Colaborările noastre");
  expect(container.querySelector("img").getAttribute("src")).toBe("/owned/new-dedeman.svg");
});

test("never replaces a custom placeholder list or guesses an ambiguous logo", async () => {
  await render({ partners: [
    { id: "custom", name: "Partener nou", replaceable: true, logoMediaId: "" },
    { id: "palatul", name: "Palat Ioan Festeleu", replaceable: false, logoMediaId: "" },
  ] });
  expect(names()).toEqual(["Partener nou", "Palat Ioan Festeleu"]);
  expect(container.querySelectorAll("img")).toHaveLength(0);
});

test("splits an Admin-managed list across two opposite bands without inventing logos", async () => {
  useReducedMotion.mockReturnValue(false);
  const partners = [
    { id: "infinity", name: "Infinity Ballroom", logoMediaId: "" },
    { id: "palatul", name: "Palat Ioan Festeleu", logoMediaId: "" },
    ...Array.from({ length: 5 }, (_, index) => ({ id: `brand-${index}`, name: `Brand ${index}`, logoMediaId: "" })),
  ];
  await render({ partners });
  const scene = container.querySelector('[data-testid="partner-marquee"]');
  expect([...scene.querySelectorAll('[data-partner-lane]')].map(lane => lane.dataset.direction)).toEqual(["right", "left"]);
  expect(names()).toEqual(partners.map(partner => partner.name));
  expect(container.querySelector('[aria-controls="fireart-partner-marks"]')).toBeNull();
  expect(container.querySelectorAll('li[data-partner-id="infinity"] img, li[data-partner-id="palatul"] img')).toHaveLength(0);
});

test("keeps every Admin partner in the two bands when there are more than 26", async () => {
  useReducedMotion.mockReturnValue(false);
  const partners = Array.from({ length: 31 }, (_, index) => ({ id: `brand-${index}`, name: `Brand ${index}`, logoMediaId: "" }));
  await render({ partners });
  const scene = container.querySelector('[data-testid="partner-marquee"]');
  expect(scene.querySelectorAll('[data-partner-lane]')).toHaveLength(2);
  expect(names()).toEqual(partners.map(partner => partner.name));
  expect(scene.querySelectorAll('[data-marquee-copy="false"] [data-partner-id]')).toHaveLength(31);
});

test("uses the original Colț de Rai logo only after the owner confirmed Negrești-Oaș", async () => {
  await render({ partners: [{ id: "colt", name: "Colț de Rai Negrești-Oaș", logoMediaId: "" }] });
  expect(names()).toEqual(["Colț de Rai Negrești-Oaș"]);
  expect(container.querySelector("img").getAttribute("src")).toBe("/media/partners/colt-de-rai-negresti.jpg");
});

test("keeps a readable partner name and removes broken image UI when a logo fails", async () => {
  await render({
    partners: [{ id: "custom", name: "Brand real", logoMediaId: "missing" }],
    mediaItems: [{ id: "missing", type: "image", src: "/missing-logo.png" }],
  });
  const image = container.querySelector("img");
  await act(async () => image.dispatchEvent(new Event("error")));
  expect(names()).toEqual(["Brand real"]);
  expect(container.querySelector("img")).toBeNull();
});

test("pauses the bands offscreen without removing partners from the document", async () => {
  useReducedMotion.mockReturnValue(false);
  const originalObserver = window.IntersectionObserver;
  const intersections = [];
  window.IntersectionObserver = class {
    constructor(callback) { intersections.push(callback); }
    observe() {}
    disconnect() {}
  };
  try {
    await render();
    const scene = container.querySelector('[data-testid="partner-marquee"]');
    expect(names()).toHaveLength(26);
    expect(scene.dataset.running).toBe("false");
    await act(async () => intersections[0]([{ isIntersecting: true }]));
    expect(scene.dataset.running).toBe("true");
    await act(async () => intersections[0]([{ isIntersecting: false }]));
    expect(scene.dataset.running).toBe("false");
    expect(names()).toHaveLength(26);
  } finally {
    window.IntersectionObserver = originalObserver;
  }
});

test("shows both full bands without animation or duplicated marks with reduced motion", async () => {
  await render();
  const scene = container.querySelector('[data-testid="partner-marquee"]');
  expect(scene.dataset.running).toBe("false");
  expect(scene.querySelectorAll('[data-partner-lane]')).toHaveLength(2);
  expect(scene.querySelectorAll('[aria-hidden="true"][data-marquee-copy]')).toHaveLength(0);
  expect(names()).toHaveLength(26);
});

test("pauses the scene while the document is hidden and resumes on return", async () => {
  useReducedMotion.mockReturnValue(false);
  const hidden = jest.spyOn(document, "hidden", "get").mockReturnValue(false);
  try {
    await render();
    const scene = container.querySelector('[data-testid="partner-marquee"]');
    expect(scene.dataset.running).toBe("true");
    hidden.mockReturnValue(true);
    await act(async () => document.dispatchEvent(new Event("visibilitychange")));
    expect(scene.dataset.running).toBe("false");
    hidden.mockReturnValue(false);
    await act(async () => document.dispatchEvent(new Event("visibilitychange")));
    expect(scene.dataset.running).toBe("true");
  } finally {
    hidden.mockRestore();
  }
});

test("renders one accessible copy of each partner and no all-partners button", async () => {
  useReducedMotion.mockReturnValue(false);
  await render();
  const scene = container.querySelector('[data-testid="partner-marquee"]');
  expect(names()).toHaveLength(26);
  expect(new Set(names()).size).toBe(26);
  expect(scene.querySelectorAll('[aria-hidden="true"][data-marquee-copy]')).toHaveLength(2);
  expect(container.textContent).not.toContain("Vezi toți");
});

test("lets the visitor pause the two bands", async () => {
  useReducedMotion.mockReturnValue(false);
  await render();
  const button = container.querySelector('[aria-label="Oprește mișcarea partenerilor"]');
  expect(button).not.toBeNull();
  await act(async () => button.click());
  const scene = container.querySelector('[data-testid="partner-marquee"]');
  expect(scene.dataset.running).toBe("false");
  expect(container.querySelector('[aria-label="Pornește mișcarea partenerilor"]').getAttribute('aria-pressed')).toBe("true");
  expect(names()).toHaveLength(26);
});
