const { TextEncoder, TextDecoder } = require("util");
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

const { act } = require("react");
const { createRoot } = require("react-dom/client");
const { AdminSessionProvider } = require("./AdminSessionContext");
const AdminInbox = require("./AdminInbox").default;

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const originalFetch = global.fetch;
let container;
let root;

const response = (payload, status = 200) => ({
  ok: status < 400,
  status,
  json: async () => payload,
});
const deferred = () => {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
};
const summary = (id = "inbound-001", changes = {}) => ({
  id,
  from: id === "inbound-001" ? "ana@example.com" : "ion@example.com",
  subject: id === "inbound-001" ? "Cerere nuntă" : "Festival",
  category: "contact",
  received_at: "2026-09-04T10:00:00Z",
  relay_state: "sent",
  latest_reply_at: null,
  ...changes,
});
const detail = (id = "inbound-001", changes = {}) => ({
  ...summary(id),
  to: ["contact@fireart.ro"],
  text: "<img src=x onerror=alert('xss')>\nDetalii private",
  attachments: [{ id: "a1", filename: "brief.pdf", content_type: "application/pdf", size: 2048 }],
  replies: [{ id: "r1", text: "Primul răspuns", state: "sent", created_at: "2026-09-04T10:10:00Z", sent_at: "2026-09-04T10:10:01Z" }],
  ...changes,
});

async function render({ handle } = {}) {
  global.fetch = jest.fn(async (path, options = {}) => {
    if (path === "/api/admin/auth/session") {
      return response({ admin: { username: "admin" }, csrf_token: "csrf-test", expires_at: "2030-01-01T00:00:00Z" });
    }
    const custom = handle?.(path, options);
    if (custom !== undefined) return custom;
    if (path.startsWith("/api/admin/inbox?")) {
      return response({ items: [summary(), summary("inbound-002")], total: 2, page: 1, page_size: 20 });
    }
    if (path === "/api/admin/inbox/inbound-001") return response(detail());
    if (path === "/api/admin/inbox/inbound-002") return response(detail("inbound-002"));
    throw new Error(`Unexpected request: ${path}`);
  });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => root.render(<AdminSessionProvider><AdminInbox /></AdminSessionProvider>));
}

const button = (text) => [...container.querySelectorAll("button")].find((item) => item.textContent.includes(text) || item.getAttribute("aria-label")?.includes(text));
async function click(text) {
  await act(async () => button(text).click());
}
async function change(selector, value) {
  await act(async () => {
    const element = container.querySelector(selector);
    const prototype = element.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : element.tagName === "SELECT" ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, "value").set.call(element, value);
    element.dispatchEvent(new Event(element.tagName === "SELECT" ? "change" : "input", { bubbles: true }));
  });
}
async function submit(selector) {
  await act(async () => container.querySelector(selector).dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
}

afterEach(async () => {
  if (root) await act(async () => root.unmount());
  root = null;
  container?.remove();
  global.fetch = originalFetch;
  jest.restoreAllMocks();
});

test("loads the safe list and renders message content as text", async () => {
  await render();
  expect(container.textContent).not.toContain("Detalii private");
  await click("Deschide mesajul Cerere nuntă");
  expect(container.textContent).toContain("Detalii private");
  expect(container.textContent).toContain("brief.pdf");
  expect(container.textContent).toContain("Primul răspuns");
  expect(container.querySelector("img")).toBeNull();
  expect(container.querySelector(".admin-inbox-workspace")).not.toBeNull();
});

test("search and category filters request only bounded query values", async () => {
  await render();
  await change('input[name="inbox-search"]', "  Ana & nuntă  ");
  await change('select[name="inbox-category"]', "contact");
  await submit('form[aria-label="Filtrează mesajele"]');
  const request = global.fetch.mock.calls.find(([path]) => path.includes("q=Ana"));
  expect(request[0]).toContain("q=Ana+%26+nunt%C4%83");
  expect(request[0]).toContain("category=contact");
  expect(request[0]).toContain("page=1");
});

test("a late detail response cannot replace the current selection", async () => {
  const old = deferred();
  await render({ handle: (path) => path === "/api/admin/inbox/inbound-001" ? old.promise : undefined });
  await click("Deschide mesajul Cerere nuntă");
  await click("Deschide mesajul Festival");
  expect(container.textContent).toContain("ion@example.com");
  await act(async () => old.resolve(response(detail())));
  expect(container.textContent).toContain("ion@example.com");
  expect(container.querySelector(".admin-inbox-detail").textContent).not.toContain("ana@example.com");
});

test("reply validates locally, keeps the draft on failure and reuses its id", async () => {
  let attempts = 0;
  await render({ handle: (path, options) => {
    if (path.endsWith("/reply")) {
      attempts += 1;
      return attempts === 1 ? response({ detail: "Unavailable" }, 503) : response(detail("inbound-001", { replies: [] }));
    }
    return undefined;
  } });
  await click("Deschide mesajul Cerere nuntă");
  await click("Trimite răspunsul");
  expect(container.querySelector('[role="alert"]').textContent).toContain("Scrie un răspuns");
  await change('textarea[name="inbox-reply"]', "Răspuns păstrat");
  await click("Trimite răspunsul");
  expect(container.querySelector('textarea[name="inbox-reply"]').value).toBe("Răspuns păstrat");
  await click("Reîncarcă mesajul");
  await click("Trimite răspunsul");
  const writes = global.fetch.mock.calls.filter(([path]) => path.endsWith("/reply"));
  expect(writes).toHaveLength(2);
  expect(writes[0][1].headers["X-CSRF-Token"]).toBe("csrf-test");
  expect(writes[0][1].credentials).toBe("same-origin");
  expect(JSON.parse(writes[0][1].body).reply_id).toBe(JSON.parse(writes[1][1].body).reply_id);
  expect(container.querySelector('textarea[name="inbox-reply"]').value).toBe("");
});

test("expired session removes loaded message and reply draft", async () => {
  await render({ handle: (path, options) => path.endsWith("/reply") ? response({ detail: "Expired" }, 401) : undefined });
  await click("Deschide mesajul Cerere nuntă");
  await change('textarea[name="inbox-reply"]', "Conținut privat local");
  await click("Trimite răspunsul");
  expect(container.textContent).not.toContain("Detalii private");
  expect(container.textContent).not.toContain("Conținut privat local");
  expect(container.textContent).toContain("sesiune Admin activă");
});

test("failed relay can be retried explicitly", async () => {
  const failed = detail("inbound-001", { relay_state: "failed" });
  await render({ handle: (path, options) => {
    if (path === "/api/admin/inbox/inbound-001") return response(failed);
    if (path.endsWith("/relay/retry")) return response({ ...failed, relay_state: "sent" });
    return undefined;
  } });
  await click("Deschide mesajul Cerere nuntă");
  await click("Retrimite notificarea");
  const write = global.fetch.mock.calls.find(([path]) => path.endsWith("/relay/retry"));
  expect(write[1].method).toBe("POST");
  expect(write[1].headers["X-CSRF-Token"]).toBe("csrf-test");
  expect(container.textContent).toContain("Notificare trimisă");
});
