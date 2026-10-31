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

test("every supplied collaboration has an external site or local Maps destination", async () => {
  await render();
  const links = [...container.querySelectorAll('.fa-partner__body')];
  expect(links).toHaveLength(26);
  expect(links.every(link => link.matches('a[target="_blank"][rel="noopener noreferrer"]') && link.href.startsWith("https://"))).toBe(true);
  const palat = container.querySelector('[data-partner-id="palatul"] a');
  expect(new URL(palat.href).searchParams.get("query")).toBe("Palat Ioan Festeleu Negrești-Oaș");
});

test("rejects unsafe managed URLs while retaining a destination for the actual partner name", async () => {
  await render({ partners: [{ id: "dedeman", name: "Noua locație", logoMediaId: "", href: "javascript:alert(1)" }] });
  const link = container.querySelector('.fa-partner__body');
  expect(new URL(link.href).hostname).toBe("www.google.com");
  expect(new URL(link.href).searchParams.get("query")).toBe("Noua locație");
});

test("preserves a valid managed partner destination", async () => {
  await render({ partners: [{ id: "venue", name: "Locație reală", logoMediaId: "", href: "https://example.com/locatie" }] });
  expect(container.querySelector('.fa-partner__body').href).toBe("https://example.com/locatie");
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

test('renders every current partner once in the scroll scene without duplicate captions',async()=>{
 useReducedMotion.mockReturnValue(false);await render();
 expect(container.querySelector('[data-testid="partner-scroll"]')).not.toBeNull();
 expect(names()).toHaveLength(26);expect(new Set(names()).size).toBe(26);
 expect(container.querySelectorAll('.fa-partner__body')).toHaveLength(26);
 expect(container.querySelectorAll('canvas')).toHaveLength(0);
 expect(container.querySelectorAll('button')).toHaveLength(0);
});
