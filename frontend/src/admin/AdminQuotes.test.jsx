const { TextEncoder, TextDecoder } = require("util");
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;
const { act } = require("react");
const { createRoot } = require("react-dom/client");
const { MemoryRouter, useLocation, useNavigate } = require("react-router-dom");
const { AdminSessionProvider } = require("./AdminSessionContext");
const AdminQuotes = require("./AdminQuotes").default;

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const originalFetch = global.fetch;
let root;
let container;
let navigate;
const response = (payload, status = 200) => ({ ok: status < 400, status, json: async () => payload });
const deferred = () => { let resolve; const promise = new Promise((done) => { resolve = done; }); return { promise, resolve }; };
const quote = (id = "q1", changes = {}) => ({
  id, first_name: id === "q1" ? "Ana" : "Ion", last_name: "Popescu", locality: "Cluj",
  event_type: "Nuntă", event_date: "2027-06-12", package_title: "Signature", package_id: "signature",
  created_at: "2026-09-03T12:00:00+00:00", status: "new", version: 0,
  phone: "+40712345678", email: "ana@example.com", event_location: "Sala",
  services: ["Drone"], message: "<script>alert('test')</script>", internal_note: "Notă privată",
  ...changes,
});
const summary = (id) => {
  const { phone, email, message, internal_note, services, event_location, version, ...item } = quote(id);
  return item;
};

function Location() {
  const location = useLocation();
  navigate = useNavigate();
  return <output data-location>{location.search}</output>;
}

async function render({ route = "/admin?sectiune=quotes", handle } = {}) {
  global.fetch = jest.fn(async (path, options) => {
    if (path === "/api/admin/auth/session") return response({ admin: { username: "admin" }, csrf_token: "csrf-test", expires_at: "2030-01-01T00:00:00Z" });
    const custom = handle?.(path, options);
    if (custom !== undefined) return custom;
    if (path.startsWith("/api/admin/quotes?")) return response({ items: [summary("q1"), summary("q2")], total: 2, page: 1, page_size: 25 });
    if (options.method === "GET" && path.startsWith("/api/admin/quotes/")) return response(quote(path.split("/").pop()));
    throw new Error("Unexpected request");
  });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => root.render(<MemoryRouter initialEntries={[route]}><AdminSessionProvider><AdminQuotes /><Location /></AdminSessionProvider></MemoryRouter>));
}

const button = (text) => [...container.querySelectorAll("button")].find((element) => element.textContent.includes(text) || element.getAttribute("aria-label")?.includes(text));
async function click(text) { await act(async () => button(text).click()); }
async function change(selector, value) {
  await act(async () => {
    const element = container.querySelector(selector);
    const prototype = element.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : element.tagName === "SELECT" ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, "value").set.call(element, value);
    element.dispatchEvent(new Event(element.tagName === "SELECT" ? "change" : "input", { bubbles: true }));
  });
}
async function submit(selector) { await act(async () => container.querySelector(selector).dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }))); }

afterEach(async () => {
  if (root) await act(async () => root.unmount());
  root = null;
  container?.remove();
  global.fetch = originalFetch;
  jest.restoreAllMocks();
});

test("loads URL filters, displays customer detail safely and saves only through the global session", async () => {
  const saved = deferred();
  await render({ route: "/admin?sectiune=quotes&status=new&q=cluj&page=2", handle: (path, options) => options.method === "PATCH" ? saved.promise : undefined });
  expect(global.fetch.mock.calls.some(([path]) => path.includes("status=new") && path.includes("q=cluj") && path.includes("page=2"))).toBe(true);
  expect(container.textContent).not.toContain("Notă privată");
  await click("Deschide cererea Ana Popescu");
  expect(container.querySelector("textarea").value).toBe("Notă privată");
  expect(container.querySelector("script")).toBeNull();
  expect(container.querySelector('a[href^="tel:"]').getAttribute("href")).toBe("tel:+40712345678");
  expect(container.querySelector('a[href^="mailto:"]')).not.toBeNull();
  await change('select[name="quote-status"]', "contacted");
  await change('textarea[name="internal-note"]', "Sunat la 14:30");
  await submit('form[aria-label="Editează cererea"]');
  await submit('form[aria-label="Editează cererea"]');
  const writes = global.fetch.mock.calls.filter(([, options]) => options.method === "PATCH");
  expect(writes).toHaveLength(1);
  expect(writes[0][0]).toBe("/api/admin/quotes/q1");
  expect(writes[0][1].credentials).toBe("same-origin");
  expect(writes[0][1].headers["X-CSRF-Token"]).toBe("csrf-test");
  expect(JSON.parse(writes[0][1].body)).toEqual({ version: 0, status: "contacted", internal_note: "Sunat la 14:30" });
  expect(container.textContent).not.toContain("Modificările au fost salvate.");
  await act(async () => saved.resolve(response(quote("q1", { version: 1, status: "contacted", internal_note: "Sunat la 14:30" }))));
  expect(container.textContent).toContain("Modificările au fost salvate.");
  expect(container.querySelector("textarea").value).toBe("Sunat la 14:30");
});

test("changing filters preserves Admin navigation and resets pagination; browser navigation restores controls", async () => {
  await render({ route: "/admin?sectiune=quotes&other=keep&page=3" });
  await change('input[name="quote-search"]', "Brașov & centru");
  await change('select[name="quote-filter"]', "qualified");
  await submit('form[aria-label="Filtrează cererile"]');
  const search = new URLSearchParams(container.querySelector("[data-location]").textContent);
  expect(search.get("sectiune")).toBe("quotes");
  expect(search.get("other")).toBe("keep");
  expect(search.get("page")).toBe("1");
  expect(search.get("q")).toBe("Brașov & centru");
  expect(search.get("status")).toBe("qualified");
  await act(async () => navigate(-1));
  expect(container.querySelector('input[name="quote-search"]').value).toBe("");
  expect(container.querySelector('select[name="quote-filter"]').value).toBe("");
});

test("pagination is bounded and query values cannot change the API path", async () => {
  await render({ route: "/admin?sectiune=quotes&page=-3&status=arbitrary", handle: (path) => path.includes("/quotes?") ? response({ items: [summary("q1")], total: 26, page: 1, page_size: 25 }) : undefined });
  expect(button("Pagina precedentă").disabled).toBe(true);
  await click("Pagina următoare");
  expect(new URLSearchParams(container.querySelector("[data-location]").textContent).get("page")).toBe("2");
  expect(button("Pagina următoare").disabled).toBe(true);
  expect(global.fetch.mock.calls.every(([path]) => path.startsWith("/api/admin/"))).toBe(true);
});

test("a late detail response never replaces the newly selected customer", async () => {
  const old = deferred();
  await render({ handle: (path) => path === "/api/admin/quotes/q1" ? old.promise : undefined });
  await click("Deschide cererea Ana Popescu");
  await click("Deschide cererea Ion Popescu");
  expect(container.querySelector('form[aria-label="Editează cererea"]').textContent).toContain("Ion Popescu");
  await act(async () => old.resolve(response(quote("q1"))));
  expect(container.querySelector('form[aria-label="Editează cererea"]').textContent).toContain("Ion Popescu");
});

test("older list requests cannot reintroduce rows from a previous filter", async () => {
  const old = deferred();
  await render({ handle: (path) => path.includes("/quotes?") && !path.includes("q=none") ? old.promise : path.includes("q=none") ? response({ items: [], total: 0, page: 1, page_size: 25 }) : undefined });
  await change('input[name="quote-search"]', "none");
  await submit('form[aria-label="Filtrează cererile"]');
  await act(async () => old.resolve(response({ items: [summary("q1")], total: 1, page: 1, page_size: 25 })));
  expect(container.textContent).toContain("Nu există cereri pentru filtrele alese.");
  expect(button("Deschide cererea Ana Popescu")).toBeUndefined();
});

test("conflicts preserve the private draft and require an explicit reload before another write", async () => {
  await render({ handle: (path, options) => options.method === "PATCH" ? response({ detail: "Conflict" }, 409) : undefined });
  await click("Deschide cererea Ana Popescu");
  await change('textarea[name="internal-note"]', "Notă nesalvată");
  await click("Salvează cererea");
  expect(container.querySelector("textarea").value).toBe("Notă nesalvată");
  expect(container.querySelector('[role="alert"]').textContent).toContain("versiune mai nouă");
  expect(button("Salvează cererea").disabled).toBe(true);
  jest.spyOn(window, "confirm").mockReturnValue(false);
  await click("Reîncarcă cererea");
  expect(container.querySelector("textarea").value).toBe("Notă nesalvată");
  window.confirm.mockReturnValue(true);
  await click("Reîncarcă cererea");
  expect(container.querySelector("textarea").value).toBe("Notă privată");
});

test("failed writes retain edits, while expired sessions remove private details", async () => {
  let expired = false;
  await render({ handle: (path, options) => options.method === "PATCH" ? response({ detail: "Unavailable" }, expired ? 401 : 503) : undefined });
  await click("Deschide cererea Ana Popescu");
  await change('textarea[name="internal-note"]', "Păstrează această notă");
  await click("Salvează cererea");
  expect(container.querySelector("textarea").value).toBe("Păstrează această notă");
  expect(container.textContent).not.toContain("Modificările au fost salvate.");
  expired = true;
  await click("Salvează cererea");
  expect(container.querySelector("textarea")).toBeNull();
  expect(container.textContent).not.toContain("Ana Popescu");
});

test("dirty edits block accidental row changes until discarded", async () => {
  await render();
  await click("Deschide cererea Ana Popescu");
  await change('textarea[name="internal-note"]', "Ciornă");
  expect(button("Deschide cererea Ion Popescu").disabled).toBe(true);
  await click("Anulează modificările");
  expect(button("Deschide cererea Ion Popescu").disabled).toBe(false);
  expect(container.querySelector("textarea").value).toBe("Notă privată");
});
