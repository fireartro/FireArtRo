import { act } from "react";
import { createRoot } from "react-dom/client";
import AdminLogin from "./AdminLogin";
import { AdminSessionProvider } from "./AdminSessionContext";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const originalFetch = global.fetch;

const response = ({ ok = true, status = 200, payload = {} } = {}) => ({
  ok,
  status,
  json: async () => payload,
});

async function render(element) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => root.render(element));
  return {
    container,
    async flush() { await act(async () => { await Promise.resolve(); }); },
    async unmount() { await act(async () => root.unmount()); container.remove(); },
  };
}

function setInputValue(input, value) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
  act(() => {
    setter.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

afterEach(() => {
  global.fetch = originalFetch;
  document.body.replaceChildren();
  jest.restoreAllMocks();
});

test("clears a failed password and announces only a generic login error", async () => {
  const storageSpy = jest.spyOn(Storage.prototype, "setItem");
  global.fetch = jest.fn()
    .mockResolvedValueOnce(response({ ok: false, status: 401, payload: { detail: "Datele de autentificare nu sunt valide." } }))
    .mockResolvedValueOnce(response({ ok: false, status: 401, payload: { detail: "Datele de autentificare nu sunt valide." } }));

  const view = await render(<AdminSessionProvider><AdminLogin /></AdminSessionProvider>);
  await view.flush();

  const username = view.container.querySelector('input[name="username"]');
  const password = view.container.querySelector('input[name="password"]');
  setInputValue(username, "administrator");
  setInputValue(password, "not-a-real-password");

  await act(async () => {
    view.container.querySelector("form").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await Promise.resolve();
  });

  expect(password.value).toBe("");
  expect(view.container.querySelector('[role="alert"]').textContent).toBe("Datele de autentificare nu sunt valide.");
  expect(storageSpy).not.toHaveBeenCalled();
  await view.unmount();
});
