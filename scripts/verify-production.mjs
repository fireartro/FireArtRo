import { pathToFileURL } from "node:url";

const DEFAULT_ORIGIN = "https://fireart.ro";
const TIMEOUT_MS = 20_000;

function originFromEnvironment() {
  const candidate = (process.env.FIREARTRO_BASE_URL || DEFAULT_ORIGIN).replace(/\/$/, "");
  const url = new URL(candidate);
  if (url.protocol !== "https:" && !["localhost", "127.0.0.1"].includes(url.hostname)) {
    throw new Error("Production verification requires HTTPS.");
  }
  return url.origin;
}

async function read(pathname, expectedType) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(`${originFromEnvironment()}${pathname}`, {
      headers: { "user-agent": "FireArtRo production monitor" },
      redirect: "follow",
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`${pathname} returned HTTP ${response.status}.`);
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.toLowerCase().includes(expectedType)) {
      throw new Error(`${pathname} returned an unexpected content type.`);
    }
    return { response, body: await response.text() };
  } finally {
    clearTimeout(timeout);
  }
}

export async function verifyProduction() {
  const homepage = await read("/", "text/html");
  if (!homepage.body.includes('id="root"')) {
    throw new Error("The public application shell is missing.");
  }

  const health = await read("/api/health", "application/json");
  const state = JSON.parse(health.body);
  if (
    state.status !== "ready"
    || state.database !== "ready"
    || state.indexes !== "ready"
    || !Array.isArray(state.configuration_errors)
    || state.configuration_errors.length
  ) {
    throw new Error("The API health check is not ready.");
  }

  const sitemap = await read("/api/sitemap.xml", "application/xml");
  if (!sitemap.body.includes("<loc>https://fireart.ro/</loc>")) {
    throw new Error("The sitemap does not contain the canonical homepage.");
  }

  const robots = await read("/robots.txt", "text/plain");
  if (!robots.body.includes("Sitemap: https://fireart.ro/api/sitemap.xml")) {
    throw new Error("robots.txt does not reference the live sitemap.");
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  verifyProduction()
    .then(() => console.log("FireArtRo production endpoints are ready."))
    .catch((error) => {
      console.error(error instanceof Error ? error.message : "Production verification failed.");
      process.exitCode = 1;
    });
}
