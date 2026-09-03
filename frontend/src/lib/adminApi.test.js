import { AdminApiError, adminRequest } from "./adminApi";

const originalFetch = global.fetch;

const jsonResponse = ({ ok = true, status = 200, payload = {} } = {}) => ({
  ok,
  status,
  json: async () => payload,
});
afterEach(() => {
  global.fetch = originalFetch;
  jest.restoreAllMocks();
});

test("Admin mutations carry the HttpOnly-cookie mode and current CSRF token", async () => {
  global.fetch = jest.fn().mockResolvedValue(jsonResponse({ payload: { ok: true } }));

  await expect(adminRequest("/api/admin/auth/logout", {
    method: "POST",
    csrfToken: "csrf-123",
    body: JSON.stringify({}),
  })).resolves.toEqual({ ok: true });

  expect(global.fetch).toHaveBeenCalledWith(
    "/api/admin/auth/logout",
    expect.objectContaining({
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      headers: expect.objectContaining({
        "Content-Type": "application/json",
        "X-CSRF-Token": "csrf-123",
      }),
    }),
  );
});

test("safe Admin session reads never attach a CSRF token", async () => {
  global.fetch = jest.fn().mockResolvedValue(jsonResponse({ payload: { admin: { username: "admin" } } }));

  await adminRequest("/api/admin/auth/session", { csrfToken: "must-not-leak" });

  const [, options] = global.fetch.mock.calls[0];
  expect(options.credentials).toBe("same-origin");
  expect(options.headers["X-CSRF-Token"]).toBeUndefined();
});

test("normalizes 401, 403, and 409 responses into a typed Admin error", async () => {
  global.fetch = jest.fn().mockResolvedValue(jsonResponse({
    ok: false,
    status: 409,
    payload: { detail: "Ciorna a fost modificată între timp." },
  }));

  await expect(adminRequest("/api/admin/content/draft", { method: "PUT", body: "{}", csrfToken: "token" }))
    .rejects.toEqual(expect.objectContaining({
      name: "AdminApiError",
      status: 409,
      message: "Ciorna a fost modificată între timp.",
    }));
});

test("rejects a malformed JSON response instead of returning an ambiguous result", async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => { throw new SyntaxError("Unexpected token"); },
  });

  await expect(adminRequest("/api/admin/auth/session")).rejects.toEqual(
    expect.objectContaining({ name: "AdminApiError", status: 200 }),
  );
});

test("refuses non same-origin Admin paths", async () => {
  await expect(adminRequest("https://outside.example/api/admin/auth/session"))
    .rejects.toEqual(expect.objectContaining({ name: "AdminApiError", status: 0 }));
  await expect(adminRequest("/not-api"))
    .rejects.toEqual(expect.objectContaining({ name: "AdminApiError", status: 0 }));
});
