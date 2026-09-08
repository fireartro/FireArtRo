import React, { act } from "react";
import { createRoot } from "react-dom/client";
import Home from "./Home";

jest.mock("@/components/site/Navbar", () => () => null);
jest.mock("@/components/site/Hero", () => () => null);
jest.mock("@/components/site/PageEnd", () => () => null);
jest.mock("@/components/site/SocialDock", () => () => null);
jest.mock("@/components/site/ScrollProgress", () => () => null);
jest.mock("@/components/night/HomeRunway", () => () => null);
jest.mock("@/hooks/useManagedContent", () => {
  const { CMS_DEFAULTS } = require("@/data/cmsDefaults");
  return (key, fallback) => CMS_DEFAULTS[key] ?? fallback;
});

test("the hydrated homepage schema keeps the crawlable FireArtRo logo", async () => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement("div");
  const root = createRoot(container);

  await act(async () => {
    root.render(<Home />);
  });

  const schema = JSON.parse(document.getElementById("page-structured-data").textContent);
  const organization = schema["@graph"].find((item) => (
    Array.isArray(item["@type"]) && item["@type"].includes("Organization")
  ));

  expect(organization.logo).toBe("https://fireart.ro/icon-512.png");

  await act(async () => {
    root.unmount();
  });
  delete global.IS_REACT_ACT_ENVIRONMENT;
});
