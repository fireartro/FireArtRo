const BACKEND_URL = (process.env.REACT_APP_BACKEND_URL || "").replace(/\/$/, "");
const API = `${BACKEND_URL}/api`;

export class BlogApiError extends Error {
  constructor(message, status = 0) {
    super(message);
    this.name = "BlogApiError";
    this.status = status;
  }
}

async function readJson(response) {
  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new BlogApiError(
      response.ok
        ? "Răspunsul Blogului nu este valid."
        : "Conținutul nu a putut fi încărcat.",
      response.status,
    );
  }
  if (!response.ok) {
    throw new BlogApiError(
      payload.detail || "Conținutul nu a putut fi încărcat.",
      response.status,
    );
  }
  return payload;
}

async function jsonRequest(path, options = {}) {
  const response = await fetch(`${API}${path}`, options);
  if (response.status === 204) return null;
  return readJson(response);
}

export function listPublishedPosts({ limit, signal } = {}) {
  const query = Number.isInteger(limit) ? `?limit=${limit}` : "";
  return jsonRequest(`/blog/posts${query}`, { signal, credentials: "omit", cache: "no-store" });
}

export function getPublishedPost(slug, { signal } = {}) {
  return jsonRequest(`/blog/posts/${encodeURIComponent(slug)}`, { signal, credentials: "omit", cache: "no-store" });
}

export async function fetchBlogRevision({ signal, revisionId } = {}) {
  const response = await fetch(`${API}/blog/revision`, {
    signal, credentials: "omit", cache: "no-store",
    // The existing cross-origin policy permits Content-Type/CSRF only. A small
    // unconditional public revision response works without a custom-header preflight.
    headers: revisionId && !BACKEND_URL ? { "If-None-Match": `"${revisionId}"` } : {},
  });
  if (response.status === 304) return null;
  const payload = await readJson(response);
  if (!/^[a-f0-9]{64}$/.test(payload?.revision_id)) throw new BlogApiError("Revizia Blogului nu este validă.");
  return payload;
}

// Protected operations share the Admin session's same-origin cookie/CSRF wrapper.
export function listAdminPosts(request, { signal } = {}) {
  return request("/api/admin/blog/posts", { signal });
}

export function createAdminPost(request, payload) {
  return request("/api/admin/blog/posts", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateAdminPost(request, id, payload) {
  return request(`/api/admin/blog/posts/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function deleteAdminPost(request, id, version) {
  return request(`/api/admin/blog/posts/${encodeURIComponent(id)}?version=${encodeURIComponent(version)}`, {
    method: "DELETE",
  });
}

export async function uploadAdminCover(request, preparedImage) {
  const blob = await fetch(preparedImage.dataUrl).then((response) => response.blob());
  const form = new FormData();
  const baseName = String(preparedImage.originalName || "coperta")
    .replace(/\.[^.]+$/, "");
  form.append("file", blob, `${baseName}.webp`);
  return request("/api/admin/blog/media", {
    method: "POST",
    body: form,
  });
}

export function blogMediaUrl(mediaId) {
  return mediaId
    ? `${API}/blog/media/${encodeURIComponent(mediaId)}`
    : "";
}

export function splitBlogBody(value) {
  return String(value || "")
    .trim()
    .split(/\r?\n\s*\r?\n/)
    .map((paragraph) => paragraph.split(/\r?\n/))
    .filter((lines) => lines.some((line) => line.trim()));
}
