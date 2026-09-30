import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router-dom";
import { DraftPreviewProvider } from "@/content/ManagedContentProvider";
import { CMS_DEFAULTS } from "@/data/cmsDefaults";
import HomePackages from "./HomePackages";

jest.mock("@/hooks/useNearViewport", () => () => false);
jest.mock("framer-motion", () => ({ useReducedMotion: () => true }));
jest.mock("gsap", () => ({ gsap: { registerPlugin: jest.fn() } }));
jest.mock("gsap/ScrollTrigger", () => ({ ScrollTrigger: {} }));

const packages = [
  { id: "effects", category: "Efecte speciale", title: "Mix" },
  { id: "day", category: "Artificii de zi", title: "Zi" },
  { id: "night", category: "Artificii de noapte", title: "Noapte", imageMediaId: "night-photo" },
];
const content = {
  ...CMS_DEFAULTS,
  packages,
  // A publication can predate the four curated catalogue entries.
  mediaItems: [{ id: "night-photo", type: "image", src: "/owned/package-only.webp" }],
};
const categories = ["Artificii de noapte", "Artificii de zi", "Show drone", "Efecte speciale"];
const curatedSources = [
  "/media/gallery/fireartro-artificii-noapte-spectacol-110.webp",
  "/media/gallery/fireartro-artificii-zi-spectacol-003.webp?v=source-crop-20260828",
  "/media/gallery/fireartro-drone-show-mastercard-img-5103.webp",
  "/media/gallery/fireartro-nunta-spectacol-019.webp",
];

function LocationProbe() {
  const location = useLocation();
  return <output>{location.pathname}{location.search}</output>;
}

let container;
let root;
beforeEach(() => {
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
const render = async (data = content) => act(async () => root.render(
  <MemoryRouter>
    <DraftPreviewProvider content={data}><HomePackages /></DraftPreviewProvider>
    <LocationProbe />
  </MemoryRouter>,
));
const rows = () => [...container.querySelectorAll(".fa-packages__category")];

test("keeps CMS category order, native deep links and discovery copy without option counts", async () => {
  await render();
  expect(rows().map(row => row.dataset.packageCategory)).toEqual(categories);
  rows().forEach((row, index) => {
    expect(row.getAttribute("href")).toBe(`/pachete?categorie=${encodeURIComponent(categories[index])}`);
    expect(row.textContent).toContain("Vezi mai multe opțiuni");
  });
  expect(rows()[2].textContent).toContain("Spectacole de drone");
  expect(container.textContent).not.toMatch(/\d+\s+opțiun/);
});

test("shows all category images together using the curated catalogue when CMS entries are missing", async () => {
  await render();
  expect(rows()).toHaveLength(4);
  expect(rows().map(row => row.querySelector("img").getAttribute("src"))).toEqual(curatedSources);
  expect(container.querySelectorAll("img")).toHaveLength(4);
  expect(rows()[0].getAttribute("href")).toBe("/pachete?categorie=Artificii%20de%20noapte");
});

test("hover keeps each category image, description and destination available", async () => {
  await render();
  await act(async () => rows()[1].dispatchEvent(new MouseEvent("mouseover", { bubbles: true })));
  expect(rows()[1].querySelector("img").getAttribute("src")).toBe(curatedSources[1]);
  expect(rows()[1].textContent).toContain("Culoare și efecte cu impact vizibil în lumină naturală.");
  expect(rows()[1].getAttribute("href")).toBe("/pachete?categorie=Artificii%20de%20zi");
  expect(rows()[0].querySelector("img").getAttribute("src")).toBe(curatedSources[0]);
});

test("keyboard focus stays on the category card and its link navigates to the CMS URL", async () => {
  await render();
  await act(async () => rows()[2].focus());
  expect(document.activeElement).toBe(rows()[2]);
  expect(rows()[2].querySelector("img").getAttribute("src")).toBe(curatedSources[2]);
  expect(rows()[2].getAttribute("aria-label")).toBe("Vezi Spectacole de drone");
  await act(async () => rows()[2].dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 })));
  expect(container.querySelector("output").textContent).toBe("/pachete?categorie=Show%20drone");
});

test("category cards expose every distinct image and link without interaction", async () => {
  await render();
  const scenes = rows();
  expect(scenes.map(item => item.querySelector("img").getAttribute("src"))).toEqual(curatedSources);
  expect(scenes.map(item => item.getAttribute("href"))).toEqual(categories.map(category => `/pachete?categorie=${encodeURIComponent(category)}`));
  expect(scenes.slice(1).every(item => item.querySelector("img").getAttribute("loading") === "lazy")).toBe(true);
  await act(async () => scenes[3].dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 })));
  expect(container.querySelector("output").textContent).toBe("/pachete?categorie=Efecte%20speciale");
});

test("honors a published replacement for the curated ID and retains additional CMS categories", async () => {
  await render({
    ...content,
    homePage: { ...content.homePage, packages: { ...content.homePage.packages, title: "Spectacolele noastre" } },
    packages: [...packages, { id: "custom", category: "Lumină & scenă", shortDescription: "Descriere din CMS", imageMediaId: "custom-image" }],
    mediaItems: [
      { id: "gallery-import-110", src: "/owned/night-v2.webp?v=2" },
      { id: "custom-image", src: "/owned/custom.webp" },
    ],
  });
  expect(container.querySelector("h2").textContent).toBe("Spectacolele noastre");
  expect(rows()[0].querySelector("img").getAttribute("src")).toBe("/owned/night-v2.webp?v=2");
  await act(async () => rows()[4].focus());
  expect(rows()[4].textContent).toContain("Descriere din CMS");
  expect(rows()[4].querySelector("img").getAttribute("src")).toBe("/owned/custom.webp");
  expect(rows()[4].getAttribute("href")).toBe("/pachete?categorie=Lumin%C4%83%20%26%20scen%C4%83");
});

test("keeps only available category cards when CMS removes packages", async () => {
  await render();
  await act(async () => rows()[3].focus());
  await render({ ...content, packages: [] });
  expect(rows().map(row => row.dataset.packageCategory)).toEqual(["Show drone"]);
  expect(rows()[0].getAttribute("href")).toBe("/pachete?categorie=Show%20drone");
});
