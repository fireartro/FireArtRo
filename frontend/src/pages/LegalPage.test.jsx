import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import LegalPage from "./LegalPage";
import { CMS_DEFAULTS } from "@/data/cmsDefaults";

jest.mock("@/components/site/Navbar", () => () => null);
jest.mock("@/components/site/ScrollProgress", () => () => null);
jest.mock("@/components/site/PageEnd", () => () => null);
jest.mock("@/hooks/usePageMeta", () => () => {});
let mockShareCapital = "";
jest.mock("@/hooks/useManagedContent", () => ({
  __esModule: true,
  default: (key, fallback) => key === "siteDetails" ? { ...fallback, shareCapital: mockShareCapital } : key === "legalPages" ? {
    ...fallback,
    terms: { title: "Termeni editați", updatedLabel: "Astăzi", sections: [
      { id: "cms-copy", heading: "Condiții", paragraphs: ["Textul juridic editat din Admin."] },
    ] },
  } : fallback,
}));

test("company identity remains visible when CMS legal copy omits the supplier", async () => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  const host = document.createElement("div");
  const root = createRoot(host);
  try {
    await act(async () => root.render(<MemoryRouter><LegalPage type="termeni" /></MemoryRouter>));
    expect(host.textContent).toContain("Textul juridic editat din Admin.");
    expect(host.textContent).toContain(CMS_DEFAULTS.siteDetails.legalName);
    expect(host.textContent).toContain(CMS_DEFAULTS.siteDetails.taxId);
    expect(host.textContent).toContain(CMS_DEFAULTS.siteDetails.registrationNumber);
    expect(host.textContent).toContain(CMS_DEFAULTS.siteDetails.registeredOffice);
    expect(host.querySelector(`a[href="mailto:${CMS_DEFAULTS.siteDetails.email}"]`)).not.toBeNull();
  } finally {
    await act(async () => root.unmount());
    delete global.IS_REACT_ACT_ENVIRONMENT;
  }
});

test.each([
  ["", false],
  ["   ", false],
  ["1.000 lei", true],
])("legal identity shows share capital only for a present amount (%p)", async (value, visible) => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  mockShareCapital = value;
  const host = document.createElement("div");
  const root = createRoot(host);
  try {
    await act(async () => root.render(<MemoryRouter><LegalPage type="termeni" /></MemoryRouter>));
    const identity = host.querySelector(".legal-identity");
    expect(identity.textContent.includes("Capital social")).toBe(visible);
    if (visible) expect(identity.textContent).toContain("1.000 lei");
  } finally {
    await act(async () => root.unmount());
    mockShareCapital = "";
    delete global.IS_REACT_ACT_ENVIRONMENT;
  }
});
