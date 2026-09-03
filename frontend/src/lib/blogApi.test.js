import {
  blogMediaUrl,
  createAdminPost,
  deleteAdminPost,
  getPublishedPost,
  listAdminPosts,
  listPublishedPosts,
  splitBlogBody,
  updateAdminPost,
  uploadAdminCover,
} from "./blogApi";
import { adminRequest } from "./adminApi";

const summary = {
  id: "post-1",
  slug: "primul-articol",
  title: "Primul articol",
  excerpt: "Rezumat",
  category: "Noutăți",
  cover_media_id: "",
  cover_alt: "",
  updated_at: "2026-08-30T10:00:00+00:00",
  published_at: "2026-08-30T10:00:00+00:00",
};

const originalFetch = global.fetch;
const originalBackendUrl = process.env.REACT_APP_BACKEND_URL;
const sessionRequest = (path, options) => adminRequest(path, {
  ...options,
  csrfToken: "csrf-blog-session",
});

const jsonResponse = (payload, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => payload,
});

afterEach(() => {
  global.fetch = originalFetch;
  if (originalBackendUrl === undefined) delete process.env.REACT_APP_BACKEND_URL;
  else process.env.REACT_APP_BACKEND_URL = originalBackendUrl;
  jest.restoreAllMocks();
});

test("public preview requests exactly limit three and returns API data", async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => [summary],
  });

  await expect(listPublishedPosts({ limit: 3 })).resolves.toEqual([summary]);
  expect(global.fetch).toHaveBeenCalledWith(
    "/api/blog/posts?limit=3",
    { signal: undefined },
  );
});

test("admin listing uses session cookies without an Admin key or CSRF on reads", async () => {
  global.fetch = jest.fn().mockResolvedValue(jsonResponse([summary]));
  const controller = new AbortController();

  await expect(listAdminPosts(sessionRequest, { signal: controller.signal })).resolves.toEqual([summary]);

  expect(Object.keys(global.fetch.mock.calls[0][1].headers || {})).not.toContain("X-Admin-Key");
  expect(global.fetch).toHaveBeenCalledWith(
    "/api/admin/blog/posts",
    expect.objectContaining({
      method: "GET",
      credentials: "same-origin",
      cache: "no-store",
      headers: {},
      signal: controller.signal,
    }),
  );
});

test("failed public requests preserve BlogApiError status and Romanian detail", async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: false,
    status: 401,
    json: async () => ({ detail: "Acces neautorizat." }),
  });

  await expect(getPublishedPost("inexistent")).rejects.toEqual(
    expect.objectContaining({
      name: "BlogApiError",
      status: 401,
      message: "Acces neautorizat.",
    }),
  );
});

test.each([401, 403, 422, 503])("admin HTTP %s preserves the session wrapper error", async (status) => {
  global.fetch = jest.fn().mockResolvedValue(jsonResponse({ detail: "Articolul nu a fost salvat." }, status));

  await expect(updateAdminPost(sessionRequest, "post-1", { status: "published" })).rejects.toEqual(
    expect.objectContaining({ name: "AdminApiError", status, message: "Articolul nu a fost salvat." }),
  );
});

test("article writes keep long plain text intact and carry cookie and CSRF protection", async () => {
  global.fetch = jest.fn().mockResolvedValue(jsonResponse({ id: "post-1", status: "draft" }, 201));
  const body = "ș".repeat(49970) + "\n\n<script>alert(1)</script>";
  const payload = { title: "Articol", excerpt: "", body, category: "", cover_media_id: "", cover_alt: "" };

  await expect(createAdminPost(sessionRequest, payload)).resolves.toEqual({ id: "post-1", status: "draft" });
  const [url, options] = global.fetch.mock.calls[0];
  expect(url).toBe("/api/admin/blog/posts");
  expect(Object.keys(options.headers || {})).not.toContain("X-Admin-Key");
  expect(options).toEqual(expect.objectContaining({
    method: "POST",
    credentials: "same-origin",
    cache: "no-store",
    headers: { "Content-Type": "application/json", "X-CSRF-Token": "csrf-blog-session" },
  }));
  expect(JSON.parse(options.body)).toEqual(payload);
  expect(new Blob([options.body]).size).toBeGreaterThan(32768);
  expect(new Blob([options.body]).size).toBeLessThan(131072);
});

test("article update encodes the id and deletion handles an empty 204 through the session wrapper", async () => {
  global.fetch = jest.fn()
    .mockResolvedValueOnce(jsonResponse({ status: "published" }))
    .mockResolvedValueOnce({ ok: true, status: 204 });

  await expect(updateAdminPost(sessionRequest, "post/1", { status: "published" })).resolves.toEqual({ status: "published" });
  expect(Object.keys(global.fetch.mock.calls[0][1].headers || {})).not.toContain("X-Admin-Key");
  expect(global.fetch).toHaveBeenNthCalledWith(1, "/api/admin/blog/posts/post%2F1", expect.objectContaining({
    method: "PUT",
    body: '{"status":"published"}',
    headers: { "Content-Type": "application/json", "X-CSRF-Token": "csrf-blog-session" },
  }));
  await expect(deleteAdminPost(sessionRequest, "post/1")).resolves.toBeNull();
  expect(global.fetch).toHaveBeenNthCalledWith(2, "/api/admin/blog/posts/post%2F1", expect.objectContaining({
    method: "DELETE",
    credentials: "same-origin",
    headers: { "X-CSRF-Token": "csrf-blog-session" },
  }));
});

test("cover uploads send WebP multipart data with CSRF and let the browser set its boundary", async () => {
  const blob = new Blob(["RIFF1234WEBP"], { type: "image/webp" });
  global.fetch = jest.fn()
    .mockResolvedValueOnce({ blob: async () => blob })
    .mockResolvedValueOnce(jsonResponse({ id: "507f1f77bcf86cd799439011" }, 201));

  await expect(uploadAdminCover(sessionRequest, {
    originalName: "Copertă.jpg",
    dataUrl: "data:image/webp;base64,UklGRjEyMzRXRUJQ",
  })).resolves.toEqual({ id: "507f1f77bcf86cd799439011" });
  expect(global.fetch).toHaveBeenNthCalledWith(1, "data:image/webp;base64,UklGRjEyMzRXRUJQ");
  const [url, options] = global.fetch.mock.calls[1];
  expect(url).toBe("/api/admin/blog/media");
  expect(Object.keys(options.headers || {})).not.toContain("X-Admin-Key");
  expect(options).toEqual(expect.objectContaining({
    method: "POST",
    credentials: "same-origin",
    headers: { "X-CSRF-Token": "csrf-blog-session" },
  }));
  const file = options.body.get("file");
  expect(file.name).toBe("Copertă.webp");
  expect(file.type).toBe("image/webp");
  expect(file.size).toBe(blob.size);
});

test("public detail and media URLs keep the configured backend while Admin stays same-origin", async () => {
  process.env.REACT_APP_BACKEND_URL = "https://public-api.example/";
  let configuredApi;
  jest.isolateModules(() => { configuredApi = require("./blogApi"); });
  global.fetch = jest.fn().mockResolvedValue(jsonResponse(summary));
  const controller = new AbortController();

  await configuredApi.getPublishedPost("știri/noi", { signal: controller.signal });
  expect(global.fetch).toHaveBeenLastCalledWith("https://public-api.example/api/blog/posts/%C8%99tiri%2Fnoi", { signal: controller.signal });
  expect(configuredApi.blogMediaUrl("image/1")).toBe("https://public-api.example/api/blog/media/image%2F1");
  await configuredApi.listAdminPosts(sessionRequest);
  expect(global.fetch.mock.calls[1][0]).toBe("/api/admin/blog/posts");
  expect(global.fetch).toHaveBeenLastCalledWith("/api/admin/blog/posts", expect.objectContaining({ credentials: "same-origin" }));
});

test("same-origin public media URLs remain compatible and missing covers stay empty", () => {
  expect(blogMediaUrl("image/1")).toBe("/api/blog/media/image%2F1");
  expect(blogMediaUrl("")).toBe("");
});

test("successful HTML fallback is rejected instead of crashing the Blog route", async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => {
      throw new SyntaxError("Unexpected token '<'");
    },
  });

  await expect(listPublishedPosts()).rejects.toEqual(
    expect.objectContaining({
      name: "BlogApiError",
      status: 200,
      message: "Răspunsul Blogului nu este valid.",
    }),
  );
});

test("body splitting preserves text and separates blank-line paragraphs", () => {
  expect(splitBlogBody(
    "Paragraf unu.\nLinia doi.\n\n<script>alert(1)</script>",
  )).toEqual([
    ["Paragraf unu.", "Linia doi."],
    ["<script>alert(1)</script>"],
  ]);
});
