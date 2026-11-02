import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { DraftPreviewProvider } from "@/content/ManagedContentProvider";
import { CMS_DEFAULTS } from "@/data/cmsDefaults";
import { SERVICE_CATALOG, findService } from "@/data/serviceCatalog";
import ServicePage from "./ServicePage";

jest.mock("@/components/site/Navbar", () => () => null);
jest.mock("@/components/site/PageEnd", () => () => null);
jest.mock("@/components/site/ScrollProgress", () => () => null);

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let container;
let root;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  document.querySelector('link[rel="canonical"]')?.remove();
  document.querySelector('meta[name="robots"]')?.remove();
});

async function render(slug, content = CMS_DEFAULTS) {
  await act(async () => root.render(
    <MemoryRouter initialEntries={[`/servicii/${slug}`]}>
      <DraftPreviewProvider content={content}>
        <Routes><Route path="/servicii/:slug" element={<ServicePage />} /></Routes>
      </DraftPreviewProvider>
    </MemoryRouter>,
  ));
}

test("the public service catalogue resolves only known service slugs", () => {
  expect(SERVICE_CATALOG.map((service) => service.slug)).toEqual([
    "artificii-nunta", "spectacole-drone", "artificii-de-zi", "efecte-speciale",
  ]);
  expect(findService("spectacole-drone").category).toBe("Show drone");
  expect(findService("__proto__")).toBeUndefined();
  expect(findService("/servicii/spectacole-drone")).toBeUndefined();
  expect(findService("serviciu-inexistent")).toBeUndefined();
});

test.each(["artificii-nunta", "spectacole-drone", "artificii-de-zi", "efecte-speciale"])(
  "%s exposes its own canonical, visible description and matching service schema",
  async (slug) => {
    await render(slug);
    const service = findService(slug);
    expect(container.querySelectorAll("h1")).toHaveLength(1);
    expect(container.querySelector("h1").textContent).toBe(service.title);
    expect(container.textContent).toContain(service.description);
    expect(document.querySelector('link[rel="canonical"]').href).toBe(`https://fireart.ro${service.path}`);
    const schema = JSON.parse(document.getElementById("page-structured-data").textContent);
    const description = schema["@graph"].find((entry) => entry["@type"] === "Service");
    expect(description.url).toBe(`https://fireart.ro${service.path}`);
    expect(description.description).toBe(service.description);
    expect(description.name).toBe(container.querySelector("h1").textContent);
    const crumbs = schema["@graph"].find((entry) => entry["@type"] === "BreadcrumbList");
    expect(crumbs.itemListElement.map((entry) => entry.name)).toEqual(["Acasă", service.title]);
    expect(container.querySelector('nav[aria-label="Fir de navigare"] [aria-current="page"]').textContent).toBe(service.title);
    expect(container.querySelector(`a[href="/pachete?categorie=${encodeURIComponent(service.category)}"]`)).not.toBeNull();
    expect(container.querySelector('a[href="/contact"]')).not.toBeNull();
    for (const { q, a } of service.faq) {
      expect(container.textContent).toContain(q);
      expect(container.textContent).toContain(a);
    }
  },
);

test("service copy uses the currently supplied business and published package names", async () => {
  const content = {
    ...CMS_DEFAULTS,
    siteDetails: { ...CMS_DEFAULTS.siteDetails, name: "Nume publicat", email: "publicat@example.com" },
    packages: [
      { ...CMS_DEFAULTS.packages[0], id: "published-package", category: "Artificii de noapte", title: "Pachet publicat" },
      { ...CMS_DEFAULTS.packages[0], id: "other-package", category: "Artificii de zi", title: "Alt serviciu" },
    ],
  };
  await render("artificii-nunta", content);
  expect(container.textContent).toContain("Nume publicat");
  expect(document.title).toBe("Artificii pentru nuntă | Nume publicat");
  expect(container.textContent).toContain("Pachet publicat");
  expect(container.textContent).not.toContain("Alt serviciu");
  expect(container.querySelector('a[href="mailto:publicat@example.com"]')).not.toBeNull();
  const schema = JSON.parse(document.getElementById("page-structured-data").textContent);
  expect(schema["@graph"][0].provider.name).toBe("Nume publicat");
});

test("an empty published package category stays empty and does not restore fallback offers", async () => {
  await render("artificii-nunta", { ...CMS_DEFAULTS, packages: [] });
  expect(container.textContent).not.toContain("Pachete din această categorie");
  expect(container.textContent).not.toContain(CMS_DEFAULTS.packages[0].title);
  expect(container.querySelector('a[href="/contact"]')).not.toBeNull();
});

test("an unknown service is marked noindex and offers a real route back", async () => {
  await render("serviciu-inexistent");
  expect(container.querySelector("h1").textContent).toBe("Serviciul nu a fost găsit");
  expect(document.querySelector('meta[name="robots"]').content).toBe("noindex, nofollow");
  expect(document.getElementById("page-structured-data")).toBeNull();
  expect(container.querySelector('a[href="/pachete"]')).not.toBeNull();
});
