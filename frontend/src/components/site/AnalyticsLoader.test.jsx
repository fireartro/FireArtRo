import { act, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, useNavigate } from "react-router-dom";

import AnalyticsLoader from "./AnalyticsLoader";
import { COOKIE_CONSENT_STORAGE_KEY } from "./CookieConsent";
import { ANALYTICS_EVENT, trackQuoteAccepted } from "@/lib/analytics";


globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let container;
let root;
let previousMeasurementId;
let previousTagId;

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
  previousTagId = process.env.REACT_APP_GA_TAG_ID;
  process.env.REACT_APP_GA_MEASUREMENT_ID = "G-ABC123XYZ";
  delete process.env.REACT_APP_GA_TAG_ID;
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
  delete window[`ga-disable-${(process.env.REACT_APP_GA_MEASUREMENT_ID || "").trim()}`];
  delete window[`ga-disable-${(process.env.REACT_APP_GA_TAG_ID || "").trim()}`];
  if (previousMeasurementId === undefined) delete process.env.REACT_APP_GA_MEASUREMENT_ID;
  else process.env.REACT_APP_GA_MEASUREMENT_ID = previousMeasurementId;
  if (previousTagId === undefined) delete process.env.REACT_APP_GA_TAG_ID;
  else process.env.REACT_APP_GA_TAG_ID = previousTagId;
  jest.useRealTimers();
  document.cookie = '_ga=; Max-Age=0; path=/';
  document.cookie = 'unrelated=; Max-Age=0; path=/';
});

test("does not contact Google without consent, outside production, or in Admin", async () => {
  process.env.REACT_APP_GA_TAG_ID = "GT-BOOTSTRAP123";
  consent(false);
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

test.each(["GT-BOOTSTRAP123", "G-LINKED123"])(
  "configures linked Google tag %s and routes every explicit event to the existing GA4 destination",
  async tagId => {
    process.env.REACT_APP_GA_TAG_ID = tagId;
    consent(true);
    await render();

    expect(document.getElementById("fireartro-ga4-script").src)
      .toBe(`https://www.googletagmanager.com/gtag/js?id=${tagId}`);
    const configurations = window.dataLayer.filter(entry => entry[0] === "config");
    expect(configurations).toHaveLength(1);
    expect(configurations[0][1]).toBe(tagId);
    expect(window["ga-disable-G-ABC123XYZ"]).toBe(false);
    expect(window[`ga-disable-${tagId}`]).toBe(true);

    act(() => container.querySelector("button").click());
    clickContact("tel:+40787602144");
    act(() => trackQuoteAccepted());
    const events = window.dataLayer.filter(entry => entry[0] === "event");
    expect(events.map(entry => entry[1])).toEqual([
      "page_view", "page_view", "contact_click", "generate_lead",
    ]);
    expect(events.map(entry => entry[2].send_to)).toEqual([
      "G-ABC123XYZ", "G-ABC123XYZ", "G-ABC123XYZ", "G-ABC123XYZ",
    ]);

    await act(async () => window.dispatchEvent(new CustomEvent("fireartro-cookie-consent-updated", {
      detail: { analytics: false },
    })));
    expect(window["ga-disable-G-ABC123XYZ"]).toBe(true);
    expect(window[`ga-disable-${tagId}`]).toBe(true);
    clickContact("tel:+40787602144");
    act(() => trackQuoteAccepted());
    expect(window.dataLayer.filter(entry => entry[0] === "event")).toHaveLength(4);
  },
);

test("blocks a routing tag's own stream before inserting the Google script", async () => {
  process.env.REACT_APP_GA_TAG_ID = "G-LINKED123";
  consent(true);
  const flagsAtScriptInsertion = [];
  const appendChild = document.head.appendChild.bind(document.head);
  const spy = jest.spyOn(document.head, "appendChild").mockImplementation(node => {
    if (node.id === "fireartro-ga4-script") flagsAtScriptInsertion.push({
      routingDisabled: window["ga-disable-G-LINKED123"],
      destinationDisabled: window["ga-disable-G-ABC123XYZ"],
    });
    return appendChild(node);
  });
  try {
    await render();
    expect(flagsAtScriptInsertion).toEqual([{ routingDisabled: true, destinationDisabled: false }]);
  } finally { spy.mockRestore(); }
});

test.each(["GTM-ABC123XYZ", "GT-BOOTSTRAP123&l=other", "GT-"])(
  "does not load Google when the explicitly configured tag ID is invalid: %s",
  async tagId => {
    process.env.REACT_APP_GA_TAG_ID = tagId;
    consent(true);
    await render();

    expect(document.getElementById("fireartro-ga4-script")).toBeNull();
    expect(window.dataLayer).toBeUndefined();
    expect(window["ga-disable-G-ABC123XYZ"]).toBe(true);
  },
);

test("a valid bootstrap tag cannot replace the required GA4 measurement destination", async () => {
  process.env.REACT_APP_GA_TAG_ID = "GT-BOOTSTRAP123";
  delete process.env.REACT_APP_GA_MEASUREMENT_ID;
  consent(true);
  await render();
  expect(document.getElementById("fireartro-ga4-script")).toBeNull();
  expect(window.dataLayer).toBeUndefined();
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
  expect(window["ga-disable-G-ABC123XYZ"]).toBe(false);
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
  expect(initialViews[0][2]).toEqual(expect.objectContaining({ page_path: "/", send_to: "G-ABC123XYZ" }));

  act(() => container.querySelector("button").click());
  const views = window.dataLayer.filter((entry) => entry[0] === "event" && entry[1] === "page_view");
  expect(views).toHaveLength(2);
  expect(views[1][2]).toEqual(expect.objectContaining({ page_path: "/pachete", send_to: "G-ABC123XYZ" }));
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

test("withdrawal in another tab stops page views and clears only analytics cookies", async () => {
  consent(true);
  await render();
  document.cookie = '_ga=example; path=/';
  document.cookie = 'unrelated=keep; path=/';
  consent(false);
  await act(async () => window.dispatchEvent(new StorageEvent('storage', { key: COOKIE_CONSENT_STORAGE_KEY })));
  expect(window['ga-disable-G-ABC123XYZ']).toBe(true);
  expect(document.cookie).not.toMatch(/(?:^|;\s*)_ga=/);
  expect(document.cookie).toContain('unrelated=keep');
  const count = window.dataLayer.length;
  act(() => container.querySelector('button').click());
  expect(window.dataLayer).toHaveLength(count);
});

test("consent expires during an open page without further interaction", async () => {
  jest.useFakeTimers();
  window.localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, JSON.stringify({
    savedAt: new Date().toISOString(), analytics: true, expiresAt: new Date(Date.now() + 2000).toISOString(),
  }));
  await render();
  expect(window['ga-disable-G-ABC123XYZ']).toBe(false);
  await act(async () => jest.advanceTimersByTime(2100));
  expect(window['ga-disable-G-ABC123XYZ']).toBe(true);
});

test("an expired consent event cannot re-enable measurement", async () => {
  await render();
  await act(async () => window.dispatchEvent(new CustomEvent('fireartro-cookie-consent-updated', {
    detail: { analytics: true, expiresAt: '2000-01-01T00:00:00Z' },
  })));
  expect(document.getElementById('fireartro-ga4-script')).toBeNull();
});

function clickContact(href) {
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.innerHTML = "<span>Contact personal</span>";
  anchor.addEventListener("click", event => event.preventDefault());
  container.appendChild(anchor);
  act(() => anchor.querySelector("span").dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 })));
}

const businessEvents = () => (window.dataLayer || []).filter(entry => entry[0] === "event"
  && ["contact_click", "generate_lead"].includes(entry[1]));

test("delegates contact clicks and confirmed leads with only fixed non-personal parameters", async () => {
  consent(true);
  await render("/contact?email=private@example.com");
  clickContact("tel:+40787602144");
  clickContact("mailto:contact@example.com?subject=Private");
  clickContact("https://wa.me/40787602144?text=Private");
  clickContact("https://wa.me.evil.test/");
  act(() => trackQuoteAccepted());
  const pageContext = { send_to: "G-ABC123XYZ", page_location: "https://fireart.ro/contact", page_referrer: "" };
  expect(businessEvents().map(entry => [entry[1], entry[2]])).toEqual([
    ["contact_click", { ...pageContext, channel: "phone" }],
    ["contact_click", { ...pageContext, channel: "email" }],
    ["contact_click", { ...pageContext, channel: "whatsapp" }],
    ["generate_lead", { ...pageContext, method: "quote_form" }],
  ]);
  expect(JSON.stringify(businessEvents())).not.toMatch(/private|40787602144|example\.com|mailto|[?]/);
  const config = window.dataLayer.find(entry => entry[0] === "config");
  expect(config[2].page_location).toBe("https://fireart.ro/contact");
  const page = window.dataLayer.find(entry => entry[0] === "event" && entry[1] === "page_view");
  expect(page[2].page_location).toBe("https://fireart.ro/contact");
});

test("business events use the current sanitized page after SPA navigation", async () => {
  consent(true);
  await render("/contact?email=private@example.com");
  act(() => container.querySelector("button").click());
  clickContact("tel:+40787602144");
  act(() => trackQuoteAccepted());
  expect(businessEvents().map(entry => [entry[1], entry[2]])).toEqual([
    ["contact_click", { send_to: "G-ABC123XYZ", channel: "phone", page_location: "https://fireart.ro/pachete", page_referrer: "" }],
    ["generate_lead", { send_to: "G-ABC123XYZ", method: "quote_form", page_location: "https://fireart.ro/pachete", page_referrer: "" }],
  ]);
});

test("business events require consent and stop immediately after withdrawal or expiry", async () => {
  jest.useFakeTimers();
  await render();
  clickContact("tel:+40787602144");
  act(() => trackQuoteAccepted());
  expect(businessEvents()).toHaveLength(0);
  await act(async () => window.dispatchEvent(new CustomEvent("fireartro-cookie-consent-updated", {
    detail: { analytics: true, expiresAt: new Date(Date.now() + 1000).toISOString() },
  })));
  clickContact("tel:+40787602144");
  expect(businessEvents()).toHaveLength(1);
  await act(async () => jest.advanceTimersByTime(1100));
  clickContact("tel:+40787602144");
  act(() => trackQuoteAccepted());
  expect(businessEvents()).toHaveLength(1);
  await act(async () => window.dispatchEvent(new CustomEvent("fireartro-cookie-consent-updated", {
    detail: { analytics: false },
  })));
  act(() => trackQuoteAccepted());
  expect(businessEvents()).toHaveLength(1);
});

test("business events stay disabled outside production, in Admin descendants and on unknown routes", async () => {
  consent(true);
  await render("/", false);
  clickContact("tel:+40787602144");
  act(() => trackQuoteAccepted());
  expect(businessEvents()).toHaveLength(0);
  await act(async () => root.unmount());
  root = createRoot(container);
  await render("/admin/inbox", true);
  clickContact("tel:+40787602144");
  act(() => trackQuoteAccepted());
  expect(businessEvents()).toHaveLength(0);
  expect(document.getElementById("fireartro-ga4-script")).toBeNull();
});

test("StrictMode leaves one contact listener and ignores arbitrary analytics signal payloads", async () => {
  consent(true);
  await act(async () => root.render(<StrictMode><MemoryRouter><Harness /></MemoryRouter></StrictMode>));
  clickContact("tel:+40787602144");
  act(() => window.dispatchEvent(new CustomEvent(ANALYTICS_EVENT, {
    detail: { name: "arbitrary_event", email: "private@example.com" },
  })));
  act(() => window.dispatchEvent(new CustomEvent(ANALYTICS_EVENT, {
    detail: { name: "generate_lead", email: "private@example.com", send_to: "G-OTHERDESTINATION" },
  })));
  expect(businessEvents().map(entry => [entry[1], entry[2]])).toEqual([
    ["contact_click", { send_to: "G-ABC123XYZ", channel: "phone", page_location: "https://fireart.ro/", page_referrer: "" }],
    ["generate_lead", { send_to: "G-ABC123XYZ", method: "quote_form", page_location: "https://fireart.ro/", page_referrer: "" }],
  ]);
});
