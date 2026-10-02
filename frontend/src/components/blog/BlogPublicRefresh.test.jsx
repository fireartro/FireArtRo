import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import HomeBlog from "./HomeBlog";
import BlogPage from "@/pages/BlogPage";
import BlogArticlePage from "@/pages/BlogArticlePage";
import { announceBlogChange } from "@/lib/blogPublicationSync";

jest.mock("@/components/site/Navbar", () => () => null);
jest.mock("@/components/site/PageEnd", () => () => null);
jest.mock("@/components/site/ScrollProgress", () => () => null);
jest.mock("@/hooks/usePageMeta", () => () => {});
jest.mock("@/hooks/useManagedContent", () => ({ __esModule: true, default: (_, fallback) => fallback }));

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const originalFetch = global.fetch;
const post = { id: "public-1", slug: "public-article", title: "Original public title", body: "Original public body", excerpt: "Summary", category: "News", cover_media_id: "", cover_alt: "", published_at: "2026-09-01T10:00:00Z", updated_at: "2026-09-01T10:00:00Z", status: "published", version: 1 };
const response = (payload, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => payload });
let container, root, publicPosts, publicPost, revision;
const flush = async (time) => act(async () => {
  jest.advanceTimersByTime(time);
  for (let i = 0; i < 15; i++) await Promise.resolve();
});

beforeEach(() => {
  jest.useFakeTimers();
  publicPosts = [post]; publicPost = post; revision = "a".repeat(64);
  Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
  Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
  global.fetch = jest.fn(async (url) => {
    if (url === "/api/blog/revision") return response({ revision_id: revision });
    if (url.startsWith("/api/blog/posts/public-article")) return publicPost ? response(publicPost) : response({ detail: "Not found" }, 404);
    if (url.startsWith("/api/blog/posts")) return response(publicPosts);
    throw new Error(`Unexpected request: ${url}`);
  });
  container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container);
});
afterEach(async () => {
  if (root) await act(async () => root.unmount()); container.remove();
  global.fetch = originalFetch; jest.useRealTimers(); jest.restoreAllMocks();
});
async function mount(element, path = "/blog") {
  await act(async () => root.render(<MemoryRouter initialEntries={[path]}>{element}</MemoryRouter>));
}

test("an empty open Home Blog shows newly published articles without remounting", async () => {
  publicPosts = [];
  await mount(<HomeBlog />);
  expect(container.textContent).toBe("");
  await flush(5000);
  publicPosts = [post]; revision = "b".repeat(64);
  await flush(5000);
  expect(container.textContent).toContain(post.title);
  expect(container.querySelector('a[href="/blog"]')).not.toBeNull();
});

test("an open archive removes unpublished articles", async () => {
  await mount(<BlogPage />);
  expect(container.textContent).toContain(post.title);
  await flush(5000);
  publicPosts = []; revision = "b".repeat(64);
  await flush(5000);
  expect(container.textContent).not.toContain(post.title);
  expect(container.textContent).toContain("Nu există articole publicate");
});

test("an open article refreshes published edits then removes an unpublished body", async () => {
  await mount(<Routes><Route path="/blog/:slug" element={<BlogArticlePage />} /></Routes>, "/blog/public-article");
  expect(container.textContent).toContain(post.body);
  await flush(5000);
  publicPost = { ...post, body: "Updated public body" }; revision = "b".repeat(64);
  await flush(5000);
  expect(container.textContent).toContain("Updated public body");
  publicPost = null; revision = "c".repeat(64);
  await flush(5000);
  expect(container.textContent).not.toContain("Updated public body");
  expect(container.textContent).toContain("Articolul nu a fost găsit");
});

test("public checks pause hidden/offline and refresh immediately on visibility and online", async () => {
  await mount(<HomeBlog />); await flush(5000);
  const calls = global.fetch.mock.calls.length;
  Object.defineProperty(document, "visibilityState", { value: "hidden" });
  act(() => document.dispatchEvent(new Event("visibilitychange")));
  publicPosts = []; revision = "b".repeat(64);
  await flush(60000);
  expect(global.fetch).toHaveBeenCalledTimes(calls);
  Object.defineProperty(document, "visibilityState", { value: "visible" });
  Object.defineProperty(navigator, "onLine", { value: false });
  act(() => document.dispatchEvent(new Event("visibilitychange")));
  await flush(10000);
  expect(global.fetch).toHaveBeenCalledTimes(calls);
  Object.defineProperty(navigator, "onLine", { value: true });
  act(() => window.dispatchEvent(new Event("online")));
  await flush(0);
  expect(container.textContent).toBe("");
});

test("unchanged revisions avoid article downloads and failed checks have bounded backoff", async () => {
  await mount(<HomeBlog />); await flush(5000);
  const contentCalls = () => global.fetch.mock.calls.filter(([url]) => url.startsWith("/api/blog/posts")).length;
  const baseline = contentCalls();
  await flush(5000); expect(contentCalls()).toBe(baseline);
  global.fetch.mockImplementation(async () => { throw new Error("offline"); });
  await flush(5000);
  const failedCalls = global.fetch.mock.calls.length;
  await flush(5000); expect(global.fetch).toHaveBeenCalledTimes(failedCalls);
  await flush(5000); expect(global.fetch).toHaveBeenCalledTimes(failedCalls + 1);
  await flush(20000); await flush(40000);
  const cappedCalls = global.fetch.mock.calls.length;
  await flush(59999); expect(global.fetch).toHaveBeenCalledTimes(cappedCalls);
  await flush(1); expect(global.fetch).toHaveBeenCalledTimes(cappedCalls + 1);
  expect(container.textContent).toContain(post.title);
});

test("same-tab and cross-tab signals only recheck public content, even when storage is denied", async () => {
  await mount(<HomeBlog />); await flush(5000);
  publicPosts = [{ ...post, title: "Server confirmed title" }]; revision = "b".repeat(64);
  jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("denied"); });
  act(() => announceBlogChange()); await flush(0);
  expect(container.textContent).toContain("Server confirmed title");
  publicPosts = []; revision = "c".repeat(64);
  act(() => window.dispatchEvent(new StorageEvent("storage", { key: "fireartro-blog-publication", newValue: JSON.stringify({ body: "Untrusted private text" }) })));
  await flush(0);
  expect(container.textContent).toBe("");
  expect(global.fetch.mock.calls.every(([url, options]) => url.startsWith("/api/blog/") && options.credentials === "omit")).toBe(true);
});

test("a failed content refresh keeps the last public view and retries the unacknowledged revision", async () => {
  await mount(<HomeBlog />); await flush(5000);
  revision = "b".repeat(64);
  const publicFetch = global.fetch.getMockImplementation();
  global.fetch.mockImplementation(async (url, options) => url.startsWith("/api/blog/posts") ? response({ detail: "Unavailable" }, 503) : publicFetch(url, options));
  await flush(5000);
  expect(container.textContent).toContain(post.title);
  publicPosts = [{ ...post, title: "Recovered public title" }];
  global.fetch.mockImplementation(publicFetch);
  await flush(10000);
  expect(container.textContent).toContain("Recovered public title");
});

test("a stalled content refresh is bounded, aborted, and cannot replace a newer response", async () => {
  await mount(<HomeBlog />);
  const publicFetch = global.fetch.getMockImplementation();
  let finishStale, staleSignal;
  global.fetch.mockImplementation((url, options) => {
    if (url.startsWith("/api/blog/posts") && !finishStale) {
      staleSignal = options.signal;
      return new Promise((resolve) => { finishStale = resolve; });
    }
    return publicFetch(url, options);
  });
  await flush(5000);
  const stalledCalls = global.fetch.mock.calls.length;
  await flush(14999);
  expect(global.fetch).toHaveBeenCalledTimes(stalledCalls);
  await flush(1); expect(staleSignal.aborted).toBe(true);
  publicPosts = [{ ...post, title: "Latest public title" }]; revision = "b".repeat(64);
  await flush(10000);
  expect(container.textContent).toContain("Latest public title");
  await act(async () => finishStale(response([{ ...post, title: "Obsolete response" }])));
  expect(container.textContent).not.toContain("Obsolete response");
});

test("disposal aborts pending checks and removes focus/online/storage listeners", async () => {
  await mount(<HomeBlog />);
  let signal;
  global.fetch.mockImplementation((_, options) => { signal = options.signal; return new Promise(() => {}); });
  await flush(5000);
  const calls = global.fetch.mock.calls.length;
  await act(async () => root.unmount()); root = null;
  expect(signal.aborted).toBe(true);
  act(() => {
    window.dispatchEvent(new Event("focus")); window.dispatchEvent(new Event("online"));
    window.dispatchEvent(new StorageEvent("storage", { key: "fireartro-blog-publication", newValue: "changed" }));
  });
  await flush(60000);
  expect(global.fetch).toHaveBeenCalledTimes(calls);
});
