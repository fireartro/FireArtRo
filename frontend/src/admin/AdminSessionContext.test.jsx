import { act, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { AdminGate } from "./AdminGate";
import { AdminSessionProvider, useAdminSession } from "./AdminSessionContext";

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

function ProtectedProbe() {
  const { request } = useAdminSession();
  return (
    <button type="button" onClick={() => request("/api/admin/content/draft", { method: "PUT", body: "{}" }).catch(() => {})}>
      Salvează ciorna
    </button>
  );
}

function TitleChangingWorkspace() {
  useEffect(() => {
    document.title = "Spațiu de lucru Admin";
  }, []);
  return <ProtectedProbe />;
}

afterEach(() => {
  global.fetch = originalFetch;
  document.body.replaceChildren();
  jest.restoreAllMocks();
});

test("restores a valid session and puts a later 401 back behind the Admin gate", async () => {
  global.fetch = jest.fn()
    .mockResolvedValueOnce(response({ payload: {
      admin: { username: "administrator" },
      csrf_token: "csrf-1",
      expires_at: "2030-01-01T00:00:00+00:00",
    } }))
    .mockResolvedValueOnce(response({ ok: false, status: 401, payload: { detail: "Datele de autentificare nu sunt valide." } }));

  const view = await render(
    <AdminSessionProvider>
      <AdminGate><ProtectedProbe /></AdminGate>
    </AdminSessionProvider>,
  );
  await view.flush();

  expect(view.container.textContent).toContain("Salvează ciorna");

  await act(async () => {
    view.container.querySelector("button").dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await Promise.resolve();
  });

  expect(view.container.textContent).toContain("Conținutul rămâne la tine în control.");
  expect(view.container.textContent).not.toContain("Salvează ciorna");
  await view.unmount();
});

test("restores the noindex Admin title after authenticated workspace unmounts", async () => {
  global.fetch = jest.fn()
    .mockResolvedValueOnce(response({ payload: {
      admin: { username: "administrator" },
      csrf_token: "csrf-1",
      expires_at: "2030-01-01T00:00:00+00:00",
    } }))
    .mockResolvedValueOnce(response({ ok: false, status: 401, payload: { detail: "Datele de autentificare nu sunt valide." } }));

  const view = await render(
    <AdminSessionProvider>
      <AdminGate><TitleChangingWorkspace /></AdminGate>
    </AdminSessionProvider>,
  );
  await view.flush();
  expect(document.title).toBe("Spațiu de lucru Admin");

  await act(async () => {
    view.container.querySelector("button").dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await Promise.resolve();
  });

  expect(document.title).toBe("Administrare | FireArtRo");
  expect(document.head.querySelector('meta[name="robots"]')?.getAttribute("content")).toBe("noindex, nofollow");
  await view.unmount();
});
