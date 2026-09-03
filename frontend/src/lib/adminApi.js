const ADMIN_API_PREFIX = "/api/admin/";
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export class AdminApiError extends Error {
  constructor(message, status = 0, payload = null) {
    super(message);
    this.name = "AdminApiError";
    this.status = status;
    this.payload = payload;
  }
}
function normalizeAdminPath(path) {
  if (typeof path !== "string" || !path.startsWith(ADMIN_API_PREFIX)) {
    throw new AdminApiError("Adresa cererii Admin nu este permisă.");
  }

  // A relative, root-bound path is intentional: session cookies never leave this site.
  if (path.includes("://") || path.startsWith("//")) {
    throw new AdminApiError("Adresa cererii Admin nu este permisă.");
  }

  return path;
}

function headerHas(headers, name) {
  return Object.keys(headers).some((key) => key.toLowerCase() === name.toLowerCase());
}

async function readJson(response) {
  if (response.status === 204) return null;
  try {
    return await response.json();
  } catch {
    throw new AdminApiError(
      response.ok
        ? "Răspunsul de administrare nu este valid."
        : "Cererea de administrare nu a putut fi procesată.",
      response.status,
    );
  }
}

export async function adminRequest(path, options = {}) {
  const url = normalizeAdminPath(path);
  const {
    csrfToken,
    headers: suppliedHeaders = {},
    method: suppliedMethod = "GET",
    body,
    ...fetchOptions
  } = options;
  const method = suppliedMethod.toUpperCase();
  const headers = { ...suppliedHeaders };

  if (typeof body === "string" && body.length > 0 && !headerHas(headers, "Content-Type")) {
    headers["Content-Type"] = "application/json";
  }
  if (!SAFE_METHODS.has(method) && csrfToken && !headerHas(headers, "X-CSRF-Token")) {
    headers["X-CSRF-Token"] = csrfToken;
  }

  let response;
  try {
    response = await fetch(url, {
      ...fetchOptions,
      method,
      body,
      headers,
      credentials: "same-origin",
      cache: "no-store",
    });
  } catch {
    throw new AdminApiError("Conexiunea cu administrarea nu este disponibilă.");
  }

  const payload = await readJson(response);
  if (!response.ok) {
    const detail = typeof payload?.detail === "string"
      ? payload.detail
      : "Cererea de administrare nu a putut fi procesată.";
    throw new AdminApiError(detail, response.status, payload);
  }

  return payload;
}
