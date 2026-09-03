import { act } from "react";
import { createRoot } from "react-dom/client";
import AdminBlogPanel from "./AdminBlogPanel";
import { AdminGate } from "./AdminGate";
import { AdminSessionProvider } from "./AdminSessionContext";
import * as imageUtils from "./imageUtils";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const originalFetch = global.fetch;
const session = {
  admin: { username: "administrator" },
  csrf_token: "csrf-blog-session",
  expires_at: "2030-01-01T00:00:00+00:00",
};
const article = {
  id: "6f69e970-5d5d-46fc-8593-62c00bf46101",
  slug: "primul-articol",
  title: "Primul articol",
  excerpt: "Rezumat",
  body: "Primul paragraf.\n\nAl doilea paragraf.",
  category: "Noutăți",
  cover_media_id: "",
  cover_alt: "",
  status: "draft",
  created_at: "2026-09-01T10:00:00+00:00",
  updated_at: "2026-09-01T10:00:00+00:00",
  published_at: null,
};
const response = (payload, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => payload,
});
let container;
let root;

async function renderPanel(posts = [article]) {
  global.fetch = jest.fn()
    .mockResolvedValueOnce(response(session))
    .mockResolvedValueOnce(response(posts));
  await mountPanel();
}

async function mountPanel() {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => root.render(
    <AdminSessionProvider><AdminGate><AdminBlogPanel /></AdminGate></AdminSessionProvider>,
  ));
}

function field(label) {
  const wrapper = [...container.querySelectorAll("label")].find((item) => item.firstElementChild?.textContent === label);
  expect(wrapper).toBeDefined();
  return wrapper.querySelector("input, textarea");
}

function button(label) {
  const result = [...container.querySelectorAll("button")].find((item) => item.textContent.includes(label));
  expect(result).toBeDefined();
  return result;
}

function setValue(input, value) {
  const prototype = input.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  act(() => {
    Object.getOwnPropertyDescriptor(prototype, "value").set.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

async function click(element) {
  await act(async () => element.click());
}

async function save() {
  await act(async () => container.querySelector("form").dispatchEvent(
    new Event("submit", { bubbles: true, cancelable: true }),
  ));
}

afterEach(async () => {
  if (root) await act(async () => root.unmount());
  container?.remove();
  root = null;
  container = null;
  global.fetch = originalFetch;
  jest.restoreAllMocks();
});

test("authenticated mount loads articles through the real session wrapper without prompting or storing credentials", async () => {
  const storage = jest.spyOn(Storage.prototype, "setItem");
  let restoreSession;
  global.fetch = jest.fn()
    .mockReturnValueOnce(new Promise((resolve) => { restoreSession = resolve; }))
    .mockResolvedValueOnce(response([article]));
  await mountPanel();
  expect(global.fetch).toHaveBeenCalledTimes(1);
  expect(container.textContent).toContain("Verificăm sesiunea");

  await act(async () => restoreSession(response(session)));

  expect(field("Titlu").value).toBe("Primul articol");
  expect(container.querySelector('input[type="password"]')).toBeNull();
  expect(global.fetch).toHaveBeenNthCalledWith(2, "/api/admin/blog/posts", expect.objectContaining({
    credentials: "same-origin", cache: "no-store", headers: {},
  }));
  expect(storage).not.toHaveBeenCalled();
});

test("initial list loading and failure cannot be mistaken for an empty blog and can be retried", async () => {
  let finishList;
  global.fetch = jest.fn()
    .mockResolvedValueOnce(response(session))
    .mockReturnValueOnce(new Promise((resolve) => { finishList = resolve; }));
  await mountPanel();
  expect(container.textContent).toContain("Se încarcă articolele");
  expect(container.textContent).not.toContain("Nu există articole");

  await act(async () => finishList(response({ detail: "Blog indisponibil." }, 503)));
  expect(container.querySelector('[role="status"]').textContent).toContain("Blog indisponibil.");
  expect(container.textContent).not.toContain("Nu există articole");
  global.fetch.mockResolvedValueOnce(response([article]));
  await click(button("Reîncearcă"));
  expect(field("Titlu").value).toBe(article.title);
});

test("new articles save plain text as a draft before publishing becomes available", async () => {
  await renderPanel([]);
  await click(button("Articol nou"));
  const publish = container.querySelector('input[type="checkbox"]');
  expect(publish.disabled).toBe(true);
  setValue(field("Titlu"), "Articol nou");
  setValue(field("Conținut"), "Text simplu.\n\n<script>alert(1)</script>");
  const saved = { ...article, title: "Articol nou", body: "Text simplu.\n\n<script>alert(1)</script>", excerpt: "", category: "" };
  global.fetch.mockResolvedValueOnce(response(saved, 201));
  await save();

  const [url, options] = global.fetch.mock.calls[2];
  expect(url).toBe("/api/admin/blog/posts");
  expect(options).toEqual(expect.objectContaining({ method: "POST", credentials: "same-origin", headers: {
    "Content-Type": "application/json", "X-CSRF-Token": "csrf-blog-session",
  } }));
  expect(JSON.parse(options.body)).toEqual({ title: "Articol nou", excerpt: "", body: "Text simplu.\n\n<script>alert(1)</script>", category: "", cover_media_id: "", cover_alt: "" });
  expect(container.textContent).toContain("Draft salvat.");
  expect(container.querySelector('input[type="checkbox"]').disabled).toBe(false);
  expect(container.querySelector('input[type="checkbox"]').checked).toBe(false);
  expect(container.querySelector(".admin-blog-list small").textContent).toBe("Draft");
  expect(container.querySelector("script")).toBeNull();
});

test.each([
  ["draft", "published", "Articol publicat.", "Publicat"],
  ["published", "draft", "Draft salvat.", "Draft"],
])("saving changes status from %s to %s only after the server confirms", async (before, after, notice, label) => {
  await renderPanel([{ ...article, status: before }]);
  await click(container.querySelector('input[type="checkbox"]'));
  let finishSave;
  global.fetch.mockReturnValueOnce(new Promise((resolve) => { finishSave = resolve; }));
  await save();
  expect(container.querySelector(".admin-blog-list small").textContent).toBe(before === "published" ? "Publicat" : "Draft");
  const [url, options] = global.fetch.mock.calls[2];
  expect(url).toBe(`/api/admin/blog/posts/${article.id}`);
  expect(options).toEqual(expect.objectContaining({ method: "PUT", credentials: "same-origin", headers: {
    "Content-Type": "application/json", "X-CSRF-Token": "csrf-blog-session",
  } }));
  expect(JSON.parse(options.body)).toEqual({ title: article.title, excerpt: article.excerpt, body: article.body, category: article.category, cover_media_id: "", cover_alt: "", status: after });
  await act(async () => finishSave(response({ ...article, status: after })));
  expect(container.textContent).toContain(notice);
  expect(container.querySelector(".admin-blog-list small").textContent).toBe(label);
  expect(container.querySelector('input[type="checkbox"]').checked).toBe(after === "published");
});

test.each([403, 422, 503, "network"])("failed save (%s) retains the editor, unsaved text and publish choice for retry", async (failure) => {
  await renderPanel();
  setValue(field("Titlu"), "Titlu nesalvat");
  setValue(field("Conținut"), "Text de păstrat.\n\nÎncă un paragraf.");
  await click(container.querySelector('input[type="checkbox"]'));
  const editor = container.querySelector("form");
  if (failure === "network") global.fetch.mockRejectedValueOnce(new TypeError("Failed to fetch"));
  else global.fetch.mockResolvedValueOnce(response({ detail: "Salvare refuzată." }, failure));
  await save();

  expect(container.querySelector("form")).toBe(editor);
  expect(field("Titlu").value).toBe("Titlu nesalvat");
  expect(field("Conținut").value).toBe("Text de păstrat.\n\nÎncă un paragraf.");
  expect(container.querySelector('input[type="checkbox"]').checked).toBe(true);
  expect(container.querySelector(".admin-blog-list small").textContent).toBe("Draft");
  expect(container.querySelector('[role="status"]').textContent).toContain(failure === "network" ? "Conexiunea" : "Salvare refuzată.");
  expect(button("Salvează articolul").disabled).toBe(false);
  global.fetch.mockResolvedValueOnce(response({ ...article, title: "Titlu nesalvat", body: "Text de păstrat.\n\nÎncă un paragraf.", status: "published" }));
  await save();
  expect(global.fetch.mock.calls[3]).toEqual(global.fetch.mock.calls[2]);
  expect(container.textContent).toContain("Articol publicat.");
});

test("an expired session returns to the shared Admin gate", async () => {
  await renderPanel();
  global.fetch.mockResolvedValueOnce(response({ detail: "Sesiune expirată." }, 401));
  await save();
  expect(container.querySelector(".admin-blog-form")).toBeNull();
  expect(container.querySelector('input[name="password"]')).not.toBeNull();
  expect(container.querySelector("#admin-blog-key")).toBeNull();
});

test("cover upload uses the session and changes only the editor until the article is saved", async () => {
  await renderPanel();
  jest.spyOn(imageUtils, "prepareAdminImage").mockResolvedValue({
    dataUrl: "data:image/webp;base64,UklGRjEyMzRXRUJQ", originalName: "coperta.jpg",
  });
  global.fetch
    .mockResolvedValueOnce({ blob: async () => new Blob(["RIFF1234WEBP"], { type: "image/webp" }) })
    .mockResolvedValueOnce(response({ id: "507f1f77bcf86cd799439011" }, 201));
  const upload = container.querySelector('input[type="file"]');
  Object.defineProperty(upload, "files", { value: [new File(["image"], "coperta.jpg", { type: "image/jpeg" })] });
  await act(async () => upload.dispatchEvent(new Event("change", { bubbles: true })));
  expect(global.fetch.mock.calls[3]).toEqual(["/api/admin/blog/media", expect.objectContaining({
    method: "POST", credentials: "same-origin", headers: { "X-CSRF-Token": "csrf-blog-session" }, body: expect.any(FormData),
  })]);
  expect(global.fetch).toHaveBeenCalledTimes(4);
  expect(container.querySelector(".admin-blog-cover img").getAttribute("src")).toBe("/api/blog/media/507f1f77bcf86cd799439011");
  expect(field("Text alternativ").required).toBe(true);
});

test("confirmed deletion uses session CSRF and selects the remaining article", async () => {
  await renderPanel([article, { ...article, id: "second-id", title: "Al doilea" }]);
  jest.spyOn(window, "confirm").mockReturnValue(true);
  global.fetch.mockResolvedValueOnce({ ok: true, status: 204 });
  await click(button("Șterge articolul"));
  expect(global.fetch).toHaveBeenLastCalledWith(`/api/admin/blog/posts/${article.id}`, expect.objectContaining({
    method: "DELETE", credentials: "same-origin", headers: { "X-CSRF-Token": "csrf-blog-session" },
  }));
  expect(field("Titlu").value).toBe("Al doilea");
  expect(container.querySelectorAll(".admin-blog-list button")).toHaveLength(1);
});
