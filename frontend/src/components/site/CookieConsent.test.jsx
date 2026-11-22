import { act, useLayoutEffect } from "react";
import { createRoot } from "react-dom/client";
import CookieConsent, { COOKIE_CONSENT_STORAGE_KEY, OPEN_COOKIE_SETTINGS_EVENT } from "./CookieConsent";
import { COOKIE_CONSENT_VERSION, readCookieConsent, retryConsentWithdrawals, saveCookieConsent } from "@/lib/cookieConsent";
import { seedConsent, TEST_CONSENT_RECEIPT } from "@/lib/consentTestFixture";

jest.mock("@/hooks/useManagedContent", () => ({ __esModule: true, default: (_key, fallback) => fallback }));
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let container, root, opener, prior;
const originalFetch = global.fetch;
const dialog = () => document.querySelector('[role="dialog"]');
const key = (value, shiftKey = false) => act(() => document.activeElement.dispatchEvent(new KeyboardEvent("keydown", { key: value, shiftKey, bubbles: true, cancelable: true })));
beforeEach(async () => {
  global.fetch = jest.fn().mockResolvedValue({ status: 204 });
  seedConsent({ analytics: true });
  opener = document.createElement("button");
  document.body.appendChild(opener);
  prior = document.createElement("div"); prior.setAttribute("inert", "existing"); document.body.appendChild(prior);
  container = document.createElement("div"); document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => root.render(<CookieConsent />));
  opener.focus();
  await act(async () => window.dispatchEvent(new Event(OPEN_COOKIE_SETTINGS_EVENT)));
});
afterEach(async () => {
  await act(async () => root.unmount());
  await retryConsentWithdrawals();
  global.fetch = originalFetch;
  container.remove(); opener.remove(); prior.remove(); localStorage.clear();
  delete document.documentElement.dataset.fireartIntro;
});

test("waits for the intro lock before opening cookies and leaves the page interactive after saving", async () => {
  await act(async () => root.unmount());
  root = createRoot(container);
  container.id = "root";
  container.setAttribute("inert", "");
  document.documentElement.dataset.fireartIntro = "loading";
  localStorage.clear();
  await act(async () => root.render(<CookieConsent />));

  expect(dialog()).toBeNull();
  expect(container.hasAttribute("inert")).toBe(true);

  await act(async () => {
    container.removeAttribute("inert");
    delete document.documentElement.dataset.fireartIntro;
    window.dispatchEvent(new Event("fireart:intro-dismissed"));
  });
  expect(dialog()).not.toBeNull();
  expect(container.hasAttribute("inert")).toBe(true);
  const save = [...dialog().querySelectorAll("button")].find(node => node.textContent === "Doar necesare");
  await act(async () => save.click());
  expect(dialog()).toBeNull();
  expect(container.hasAttribute("inert")).toBe(false);
});

test("keeps an open-settings request pending until a slow intro finishes", async () => {
  await act(async () => root.unmount());
  root = createRoot(container);
  document.documentElement.dataset.fireartIntro = "loading";
  await act(async () => root.render(<CookieConsent />));
  await act(async () => window.dispatchEvent(new Event(OPEN_COOKIE_SETTINGS_EVENT)));
  expect(dialog()).toBeNull();
  await act(async () => {
    delete document.documentElement.dataset.fireartIntro;
    window.dispatchEvent(new Event("fireart:intro-dismissed"));
  });
  expect(dialog()).not.toBeNull();
  expect(dialog().querySelector('input:not(:disabled)').checked).toBe(true);
});

test("opens cookies when the intro finishes between rendering and effect subscription", async () => {
  await act(async () => root.unmount());
  root = createRoot(container);
  container.id = "root";
  container.setAttribute("inert", "");
  document.documentElement.dataset.fireartIntro = "loading";
  localStorage.clear();
  function IntroFinishesDuringCommit() {
    useLayoutEffect(() => {
      container.removeAttribute("inert");
      delete document.documentElement.dataset.fireartIntro;
      window.dispatchEvent(new Event("fireart:intro-dismissed"));
    }, []);
    return <CookieConsent />;
  }
  await act(async () => root.render(<IntroFinishesDuringCommit />));
  expect(dialog()).not.toBeNull();
  const save = [...dialog().querySelectorAll("button")].find(node => node.textContent === "Doar necesare");
  await act(async () => save.click());
  expect(container.hasAttribute("inert")).toBe(false);
});
test("traps Tab and Shift+Tab within the cookie dialog", () => {
  const controls = [...dialog().querySelectorAll('a[href], button, input:not(:disabled)')];
  act(() => controls[controls.length - 1].focus());
  key("Tab");
  expect(document.activeElement).toBe(controls[0]);
  key("Tab", true);
  expect(document.activeElement).toBe(controls[controls.length - 1]);
});
test("isolates the background and restores its prior inert values and opener on Escape", () => {
  expect(opener.hasAttribute("inert")).toBe(true);
  key("Escape");
  expect(dialog()).toBeNull();
  expect(document.activeElement).toBe(opener);
  expect(opener.hasAttribute("inert")).toBe(false);
  expect(prior.getAttribute("inert")).toBe("existing");
});
test("saving preserves selected consent and restores the opener", async () => {
  const save = [...dialog().querySelectorAll("button")].find(node => node.textContent === "Salvează preferințele");
  await act(async () => save.click());
  expect(JSON.parse(localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY))).toEqual(expect.objectContaining({ analytics: true, marketing: false, necessary: true }));
  expect(document.activeElement).toBe(opener);
});
test("new background surfaces become inert while the modal is open", async () => {
  const added = document.createElement("aside");
  try {
    await act(async () => { document.body.appendChild(added); await Promise.resolve(); });
    expect(added.hasAttribute("inert")).toBe(true);
    key("Escape");
    expect(added.hasAttribute("inert")).toBe(false);
  } finally { added.remove(); }
});

test("rejecting works even when the browser blocks storage writes", async () => {
  const write = jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new DOMException("Storage is disabled", "SecurityError");
  });
  try {
    const reject = [...dialog().querySelectorAll("button")].find(node => node.textContent === "Doar necesare");
    await act(async () => reject.click());
    expect(dialog()).toBeNull();
    expect(container.hasAttribute("inert")).toBe(false);
  } finally {
    write.mockRestore();
    await act(async () => saveCookieConsent({ analytics: false, marketing: false }));
  }
});

test.each([
  { version: undefined },
  { analytics: "true" },
  { expiresAt: undefined },
  { expiresAt: "invalid" },
  { savedAt: new Date(Date.now() + 86_400_000).toISOString() },
])("rejects invalid stored choices %j", async fields => {
  localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, JSON.stringify({
    version: COOKIE_CONSENT_VERSION, necessary: true, analytics: true, marketing: true,
    ...TEST_CONSENT_RECEIPT, savedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 86_400_000).toISOString(), ...fields,
  }));
  expect(readCookieConsent()).toBeNull();
});

test("lets the reader open consent settings voluntarily on a policy page", async () => {
  await act(async () => root.unmount());
  localStorage.clear();
  root = createRoot(container);
  await act(async () => root.render(<CookieConsent autoPrompt={false} />));
  expect(dialog()).toBeNull();
  await act(async () => window.dispatchEvent(new Event(OPEN_COOKIE_SETTINGS_EVENT)));
  expect(dialog()).not.toBeNull();
  expect([...dialog().querySelectorAll("input:not(:disabled)")].every(input => !input.checked)).toBe(true);
  key("Escape");
  expect(dialog()).toBeNull();
});
