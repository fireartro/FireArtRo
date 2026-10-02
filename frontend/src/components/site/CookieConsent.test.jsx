import { act } from "react";
import { createRoot } from "react-dom/client";
import CookieConsent, { COOKIE_CONSENT_STORAGE_KEY, OPEN_COOKIE_SETTINGS_EVENT } from "./CookieConsent";

jest.mock("@/hooks/useManagedContent", () => ({ __esModule: true, default: (_key, fallback) => fallback }));
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let container, root, opener, prior;
const dialog = () => document.querySelector('[role="dialog"]');
const key = (value, shiftKey = false) => act(() => document.activeElement.dispatchEvent(new KeyboardEvent("keydown", { key: value, shiftKey, bubbles: true, cancelable: true })));
beforeEach(async () => {
  localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, JSON.stringify({ savedAt: new Date().toISOString(), analytics: true, marketing: false }));
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
  container.remove(); opener.remove(); prior.remove(); localStorage.clear();
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
