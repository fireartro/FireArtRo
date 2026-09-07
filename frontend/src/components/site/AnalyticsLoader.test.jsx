import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, useNavigate } from "react-router-dom";

import AnalyticsLoader from "./AnalyticsLoader";
import { COOKIE_CONSENT_STORAGE_KEY } from "./CookieConsent";


globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let container;
let root;
let previousMeasurementId;

function consent(analytics) {
  window.localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, JSON.stringify({
    necessary: true,
    analytics,
    marketing: false,
    savedAt: "2026-09-07T12:00:00.000Z",
    expiresAt: "2099-09-07T12:00:00.000Z",
  }));
}

function Harness({ production = true }) {
  const navigate = useNavigate();
  return <>
    <AnalyticsLoader production={production} />
    <button type="button" onClick={() => navigate("/pachete?tip=zi")}>Navighează</button>
  </>;
}

async function render(initialEntry = "/", production = true) {
  await act(async () => root.render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Harness production={production} />
    </MemoryRouter>,
  ));
}

beforeEach(() => {
  previousMeasurementId = process.env.REACT_APP_GA_MEASUREMENT_ID;
  process.env.REACT_APP_GA_MEASUREMENT_ID = "G-ABC123XYZ";
  window.localStorage.clear();
  delete window.dataLayer;
  delete window.gtag;
  delete window["ga-disable-G-ABC123XYZ"];
  document.getElementById("fireartro-ga4-script")?.remove();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  document.getElementById("fireartro-ga4-script")?.remove();
  window.localStorage.clear();
  delete window.dataLayer;
  delete window.gtag;
  delete window["ga-disable-G-ABC123XYZ"];
  if (previousMeasurementId === undefined) delete process.env.REACT_APP_GA_MEASUREMENT_ID;
  else process.env.REACT_APP_GA_MEASUREMENT_ID = previousMeasurementId;
});

test("does not contact Google without consent, outside production, or in Admin", async () => {
  await render();
  expect(document.getElementById("fireartro-ga4-script")).toBeNull();
  expect(window.dataLayer).toBeUndefined();

  await act(async () => root.unmount());
  root = createRoot(container);
  consent(true);
  await render("/", false);
  expect(document.getElementById("fireartro-ga4-script")).toBeNull();

  await act(async () => root.unmount());
  root = createRoot(container);
  await render("/admin", true);
  expect(document.getElementById("fireartro-ga4-script")).toBeNull();
});

test("loads GA4 only after analytics consent and records SPA page views once", async () => {
  await render();

  await act(async () => window.dispatchEvent(new CustomEvent(
    "fireartro-cookie-consent-updated",
    { detail: { necessary: true, analytics: true, marketing: false } },
  )));

  const script = document.getElementById("fireartro-ga4-script");
  expect(script).not.toBeNull();
  expect(script.src).toBe("https://www.googletagmanager.com/gtag/js?id=G-ABC123XYZ");
  const consentDefaults = window.dataLayer.filter((entry) => entry[0] === "consent" && entry[1] === "default");
  expect(consentDefaults).toHaveLength(1);
  expect(consentDefaults[0][2]).toEqual({
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
    analytics_storage: "granted",
  });
  const initialViews = window.dataLayer.filter((entry) => entry[0] === "event" && entry[1] === "page_view");
  expect(initialViews).toHaveLength(1);
  expect(initialViews[0][2]).toEqual(expect.objectContaining({ page_path: "/" }));

  act(() => container.querySelector("button").click());
  const views = window.dataLayer.filter((entry) => entry[0] === "event" && entry[1] === "page_view");
  expect(views).toHaveLength(2);
  expect(views[1][2]).toEqual(expect.objectContaining({ page_path: "/pachete" }));
});

test("stops future measurement when analytics consent is withdrawn", async () => {
  consent(true);
  await render();
  expect(document.getElementById("fireartro-ga4-script")).not.toBeNull();

  await act(async () => window.dispatchEvent(new CustomEvent(
    "fireartro-cookie-consent-updated",
    { detail: { necessary: true, analytics: false, marketing: false } },
  )));
  expect(window["ga-disable-G-ABC123XYZ"]).toBe(true);
  const consentUpdates = window.dataLayer.filter((entry) => entry[0] === "consent" && entry[1] === "update");
  expect(consentUpdates.at(-1)[2]).toEqual(expect.objectContaining({ analytics_storage: "denied" }));
  const before = window.dataLayer.length;
  act(() => container.querySelector("button").click());
  expect(window.dataLayer).toHaveLength(before);
});
