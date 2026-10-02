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
    let response;
    try {
      response = await fetch(`${originFromEnvironment()}${pathname}`, {
        headers: { "user-agent": "FireArtRo production monitor" },
        credentials: "omit",
        cache: "no-cache",
        redirect: "follow",
        signal: controller.signal,
      });
    } catch {
      throw new Error(`${pathname} could not be reached.`);
    }
    if (!response.ok) throw new Error(`${pathname} returned HTTP ${response.status}.`);
    const contentType = (response.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
    if (![expectedType].flat().includes(contentType)) {
      throw new Error(`${pathname} returned an unexpected content type.`);
    }
    let body;
    try {
      body = await response.text();
    } catch {
      throw new Error(`${pathname} could not be read.`);
    }
    return { response, body };
  } finally {
    clearTimeout(timeout);
  }
}

async function readJson(pathname) {
  const { body } = await read(pathname, "application/json");
  try {
    return JSON.parse(body);
  } catch {
    throw new Error(`${pathname} returned invalid JSON.`);
  }
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function validatePublication(publication, withContent = false) {
  if (!isObject(publication)
    || typeof publication.revision_id !== "string"
    || !/^[a-z0-9][a-z0-9-]{0,79}$/i.test(publication.revision_id)
    || typeof publication.published_at !== "string"
    || !Number.isFinite(Date.parse(publication.published_at))) {
    throw new Error("The public publication metadata is invalid.");
  }
  if (!withContent) return;
  const content = publication.content;
  const objects = ["siteDetails", "contactSettings", "businessHours", "navigation", "footer", "homePage",
    "galleryPage", "packagesPage", "faqPage", "contactPage", "blogPage", "reviewSettings", "cookieSettings", "legalPages"];
  const collections = ["socialLinks", "mediaItems", "packages", "faqs", "testimonials", "partners"];
  if (!isObject(content) || content.schema_version !== 1
    || objects.some(key => !isObject(content[key]))
    || collections.some(key => !Array.isArray(content[key]))
    || typeof content.siteDetails.name !== "string" || !content.siteDetails.name.trim()
    || !isObject(content.homePage.hero)) {
    throw new Error("The published content is invalid.");
  }
}

function criticalAssets(html) {
  const origin = originFromEnvironment();
  const assets = new Map();
  for (const [tag] of html.replace(/<!--[\s\S]*?-->/g, "").matchAll(/<(?:script|link)\b[^>]*>/gi)) {
    const attributes = Object.fromEntries([...tag.matchAll(/([^\s=<>]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)]
      .map(([, key, doubleQuoted, singleQuoted, unquoted]) => [key.toLowerCase(), doubleQuoted ?? singleQuoted ?? unquoted]));
    const script = /^<script\b/i.test(tag);
    if (script && attributes.type && !["module", "text/javascript", "application/javascript"].includes(attributes.type.toLowerCase())) continue;
    if (!script && !attributes.rel?.toLowerCase().split(/\s+/).includes("stylesheet")) continue;
    const reference = script ? attributes.src : attributes.href;
    if (!reference) continue;
    let url;
    try {
      url = new URL(reference.replace(/&amp;/g, "&"), `${origin}/`);
    } catch {
      throw new Error("The public application shell contains an invalid asset URL.");
    }
    if (url.origin !== origin) continue;
    assets.set(`${url.pathname}${url.search}`, script ? ["application/javascript", "text/javascript", "application/x-javascript"] : "text/css");
  }
  const entries = [...assets];
  if (!entries.some(([pathname, type]) => Array.isArray(type) && /^\/static\/js\/[^/?]+\.js(?:\?|$)/.test(pathname))
    || !entries.some(([pathname, type]) => type === "text/css" && /^\/static\/css\/[^/?]+\.css(?:\?|$)/.test(pathname))) {
    throw new Error("The public application shell is missing same-origin JavaScript or CSS assets.");
  }
  return assets;
}

export async function verifyProduction() {
  const homepage = await read("/", "text/html");
  if (!homepage.body.includes('id="root"')) {
    throw new Error("The public application shell is missing.");
  }

  const state = await readJson("/api/health");
  if (
    !isObject(state)
    || state.status !== "ready"
    || state.database !== "ready"
    || state.indexes !== "ready"
    || !Array.isArray(state.configuration_errors)
    || state.configuration_errors.length
  ) {
    throw new Error("The API health check is not ready.");
  }

  let publication = await readJson("/api/content");
  validatePublication(publication, true);
  const revision = await readJson("/api/content/revision");
  validatePublication(revision);
  const samePublication = () => publication.revision_id === revision.revision_id
    && Date.parse(publication.published_at) === Date.parse(revision.published_at);
  if (!samePublication()) {
    // A publication can change between these anonymous reads. Retry once.
    publication = await readJson("/api/content");
    validatePublication(publication, true);
    if (!samePublication()) throw new Error("The public publication is inconsistent with its revision.");
  }

  for (const [pathname, type] of criticalAssets(homepage.body)) {
    const { body } = await read(pathname, type);
    if (!body.trim()) throw new Error(`Critical asset ${pathname} is empty.`);
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
