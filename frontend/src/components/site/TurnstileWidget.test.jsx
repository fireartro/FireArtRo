import { act } from "react";
import { createRoot } from "react-dom/client";

import TurnstileWidget from "./TurnstileWidget";


globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let container;
let root;
let previousSiteKey;

beforeEach(() => {
  previousSiteKey = process.env.REACT_APP_TURNSTILE_SITE_KEY;
  delete window.turnstile;
  document.getElementById("fireartro-turnstile-script")?.remove();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  document.getElementById("fireartro-turnstile-script")?.remove();
  delete window.turnstile;
  if (previousSiteKey === undefined) delete process.env.REACT_APP_TURNSTILE_SITE_KEY;
  else process.env.REACT_APP_TURNSTILE_SITE_KEY = previousSiteKey;
});

test("does not load or render anything without a public site key", async () => {
  delete process.env.REACT_APP_TURNSTILE_SITE_KEY;

  await act(async () => root.render(<TurnstileWidget />));

  expect(container.textContent).toBe("");
  expect(document.getElementById("fireartro-turnstile-script")).toBeNull();
});

test("loads the explicit provider script once when a site key exists", async () => {
  process.env.REACT_APP_TURNSTILE_SITE_KEY = "public-site-key";

  await act(async () => root.render(<TurnstileWidget />));

  const script = document.getElementById("fireartro-turnstile-script");
  expect(script).not.toBeNull();
  expect(script.src).toBe(
    "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit",
  );
  expect(container.querySelector('[role="group"]')).not.toBeNull();
});

test("passes tokens, expiry, errors, reset, and cleanup through safe callbacks", async () => {
  process.env.REACT_APP_TURNSTILE_SITE_KEY = "public-site-key";
  let options;
  window.turnstile = {
    render: jest.fn((_element, value) => {
      options = value;
      return "widget-1";
    }),
    reset: jest.fn(),
    remove: jest.fn(),
  };
  const onToken = jest.fn();
  const onUnavailable = jest.fn();

  await act(async () => root.render(
    <TurnstileWidget
      onToken={onToken}
      onUnavailable={onUnavailable}
      resetSignal={0}
    />,
  ));

  expect(window.turnstile.render).toHaveBeenCalledTimes(1);
  expect(options.sitekey).toBe("public-site-key");
  expect(options.theme).toBe("dark");

  act(() => options.callback("single-use-token"));
  expect(onToken).toHaveBeenLastCalledWith("single-use-token");
  expect(onUnavailable).toHaveBeenLastCalledWith("");

  act(() => options["expired-callback"]());
  expect(onToken).toHaveBeenLastCalledWith("");
  expect(onUnavailable).toHaveBeenLastCalledWith(expect.stringMatching(/expirat/i));

  act(() => options["error-callback"]());
  expect(onToken).toHaveBeenLastCalledWith("");
  expect(onUnavailable).toHaveBeenLastCalledWith(expect.stringMatching(/disponibilă/i));

  await act(async () => root.render(
    <TurnstileWidget
      onToken={onToken}
      onUnavailable={onUnavailable}
      resetSignal={1}
    />,
  ));
  expect(window.turnstile.reset).toHaveBeenCalledWith("widget-1");

  await act(async () => root.unmount());
  expect(window.turnstile.remove).toHaveBeenCalledWith("widget-1");
  root = createRoot(container);
});
