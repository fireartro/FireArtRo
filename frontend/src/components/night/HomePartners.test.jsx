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
  expect(names()).toEqual(expect.arrayContaining(["Restaurant Capricci", "Primăria Seini", "Infinity Ballroom", "Colț de Rai", "Palatul Ioan Festeleu"]));
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
    { id: "colt", name: "Colț de Rai", replaceable: false, logoMediaId: "" },
  ] });
  expect(names()).toEqual(["Partener nou", "Colț de Rai"]);
  expect(container.querySelectorAll("img")).toHaveLength(0);
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

test("reveals each category once without removing offscreen partners from the document", async () => {
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
    const groups = container.querySelectorAll(".fa-partners-gallery__group");
    expect(names()).toHaveLength(26);
    expect(groups[0].dataset.entered).toBe("waiting");
    await act(async () => intersections[0]([{ isIntersecting: true }]));
    expect(groups[0].dataset.entered).toBe("true");
    expect(groups[1].dataset.entered).toBe("waiting");
    await act(async () => intersections[0]([{ isIntersecting: false }]));
    expect(groups[0].dataset.entered).toBe("true");
  } finally {
    window.IntersectionObserver = originalObserver;
  }
});

test("shows the entire partner gallery immediately with reduced motion", async () => {
  await render();
  const groups = [...container.querySelectorAll(".fa-partners-gallery__group")];
  expect(groups.every(group => group.dataset.entered === "true")).toBe(true);
  expect(names()).toHaveLength(26);
});
