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
