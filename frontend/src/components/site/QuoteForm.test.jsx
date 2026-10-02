import { act } from "react";
import { createRoot } from "react-dom/client";

import QuoteForm from "./QuoteForm";


globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const originalFetch = global.fetch;
let container;
let root;
let previousSiteKey;

jest.mock("@/hooks/useManagedContent", () => ({
  __esModule: true,
  default: (_key, fallback) => fallback,
}));

jest.mock("sonner", () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

jest.mock("./TurnstileWidget", () => ({
  __esModule: true,
  default: ({ onToken, onUnavailable, resetSignal }) => (
    <div data-testid="turnstile-double" data-reset-signal={resetSignal}>
      <button type="button" onClick={() => { onUnavailable(""); onToken("verified-browser-token"); }}>
        Verifică test
      </button>
    </div>
  ),
}));

function setValue(element, value) {
  const prototype = element instanceof HTMLSelectElement
    ? HTMLSelectElement.prototype
    : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, "value").set;
  act(() => {
    setter.call(element, value);
    element.dispatchEvent(new Event(element instanceof HTMLSelectElement ? "change" : "input", {
      bubbles: true,
    }));
  });
}

function completeRequiredFields() {
  setValue(container.querySelector("#quote-event-type"), "Nuntă");
  setValue(container.querySelector("#quote-date"), "2027-06-12");
  setValue(container.querySelector("#quote-locality"), "Cluj-Napoca");
  setValue(container.querySelector("#quote-service"), "Show drone");
  setValue(container.querySelector("#quote-first-name"), "Barbul");
  setValue(container.querySelector("#quote-last-name"), "Ionuț");
  setValue(container.querySelector("#quote-phone"), "0787602144");
  setValue(container.querySelector("#quote-email"), "client@example.com");
  act(() => container.querySelector("#quote-consent").click());
}

async function submit() {
  await act(async () => {
    container.querySelector("form").dispatchEvent(new Event("submit", {
      bubbles: true,
      cancelable: true,
    }));
    await Promise.resolve();
  });
}

beforeEach(async () => {
  Object.defineProperty(window, "crypto", { configurable: true, value: require("crypto").webcrypto });
  previousSiteKey = process.env.REACT_APP_TURNSTILE_SITE_KEY;
  process.env.REACT_APP_TURNSTILE_SITE_KEY = "public-site-key";
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ accepted: true }),
  });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => root.render(<QuoteForm />));
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  global.fetch = originalFetch;
  if (previousSiteKey === undefined) delete process.env.REACT_APP_TURNSTILE_SITE_KEY;
  else process.env.REACT_APP_TURNSTILE_SITE_KEY = previousSiteKey;
  jest.clearAllMocks();
});

test("requires a current anti-abuse token and sends it only after verification", async () => {
  completeRequiredFields();

  await submit();

  expect(global.fetch).not.toHaveBeenCalled();
  expect(container.textContent).toMatch(/finalizează verificarea anti-abuz/i);

  act(() => container.querySelector('[data-testid="turnstile-double"] button').click());
  await submit();

  expect(global.fetch).toHaveBeenCalledTimes(1);
  const [, options] = global.fetch.mock.calls[0];
  expect(JSON.parse(options.body)).toEqual(expect.objectContaining({
    first_name: "Barbul",
    email: "client@example.com",
    turnstile_token: "verified-browser-token",
  }));
  expect(container.querySelector('[data-testid="quote-success"]')).not.toBeNull();
});

test("resets a consumed token after a failed submission", async () => {
  global.fetch.mockResolvedValueOnce({ ok: false, status: 503, json: async () => ({}) });
  completeRequiredFields();
  act(() => container.querySelector('[data-testid="turnstile-double"] button').click());

  await submit();

  expect(container.querySelector('[data-testid="turnstile-double"]').dataset.resetSignal).toBe("1");
  await submit();
  expect(global.fetch).toHaveBeenCalledTimes(1);
  expect(container.textContent).toMatch(/finalizează verificarea anti-abuz/i);
});

test("reading privacy opens a labelled separate tab and preserves the contact draft", () => {
  completeRequiredFields();
  const policy = container.querySelector('a[href="/confidentialitate"]');
  expect(policy.target).toBe("_blank");
  expect(policy.rel).toContain("noopener");
  expect(policy.getAttribute("aria-label")).toMatch(/filă nouă/i);
  expect(container.querySelector("#quote-email").value).toBe("client@example.com");
});

test("rejects a past event date before sending a verified quote", async () => {
  completeRequiredFields();
  setValue(container.querySelector("#quote-date"), "2000-01-01");
  act(() => container.querySelector('[data-testid="turnstile-double"] button').click());
  await submit();
  expect(global.fetch).not.toHaveBeenCalled();
  expect(container.querySelector("#quote-date").getAttribute("aria-invalid")).toBe("true");
});

test("uses the local calendar date for the date input minimum", async () => {
  jest.useFakeTimers("modern");
  jest.setSystemTime(new Date("2026-10-02T23:30:00Z"));
  const year = jest.spyOn(Date.prototype, "getFullYear").mockReturnValue(2026);
  const month = jest.spyOn(Date.prototype, "getMonth").mockReturnValue(9);
  const day = jest.spyOn(Date.prototype, "getDate").mockReturnValue(3);
  try {
    await act(async () => root.unmount());
    root = createRoot(container);
    await act(async () => root.render(<QuoteForm />));
    expect(container.querySelector("#quote-date").min).toBe("2026-10-03");
  } finally {
    year.mockRestore(); month.mockRestore(); day.mockRestore();
    jest.useRealTimers();
  }
});

test("Mix prefill selects a real displayed service and keeps package identity", () => {
  act(() => window.dispatchEvent(new CustomEvent("prefill-package", {
    detail: { id: "mix", title: "Mix", category: "Efecte speciale" },
  })));
  const service = container.querySelector("#quote-service");
  expect(service.value).toBe("Alte efecte pirotehnice");
  expect(service.selectedOptions[0].textContent).toBe("Alte efecte pirotehnice");
  expect(container.querySelector(".nr-contact-optional summary").textContent).toContain("Mix");
});

test("rejects a service that is no longer in the displayed CMS options", async () => {
  completeRequiredFields();
  const service = container.querySelector("#quote-service");
  service.add(new Option("Serviciu eliminat", "Serviciu eliminat"));
  setValue(service, "Serviciu eliminat");
  act(() => container.querySelector('[data-testid="turnstile-double"] button').click());
  await submit();
  expect(global.fetch).not.toHaveBeenCalled();
  expect(service.getAttribute("aria-invalid")).toBe("true");
});

test("retries a lost response with the same UUID after anti-abuse re-verification", async () => {
  global.fetch.mockRejectedValueOnce(new TypeError("lost response"));
  completeRequiredFields();
  act(() => container.querySelector('[data-testid="turnstile-double"] button').click());
  await submit();
  const first = JSON.parse(global.fetch.mock.calls[0][1].body);
  expect(first.submission_id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  act(() => container.querySelector('[data-testid="turnstile-double"] button').click());
  await submit();
  expect(JSON.parse(global.fetch.mock.calls[1][1].body).submission_id).toBe(first.submission_id);
  expect(container.querySelector('[data-testid="quote-success"]')).not.toBeNull();
});

test("customer edits after a failed request rotate the submission UUID", async () => {
  global.fetch.mockRejectedValueOnce(new TypeError("lost response"));
  completeRequiredFields();
  act(() => container.querySelector('[data-testid="turnstile-double"] button').click());
  await submit();
  const first = JSON.parse(global.fetch.mock.calls[0][1].body).submission_id;
  expect(first).toBeDefined();
  setValue(container.querySelector("#quote-locality"), "Oradea");
  act(() => container.querySelector('[data-testid="turnstile-double"] button').click());
  await submit();
  expect(JSON.parse(global.fetch.mock.calls[1][1].body).submission_id).not.toBe(first);
});
