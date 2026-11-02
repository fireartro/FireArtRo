import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readPublicPageData } from './public-page-data.js';
import { publicPageDocument } from './public-page-document.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const require = createRequire(import.meta.url);
const PUBLIC_PATHS = new Set([
  '/', '/pachete', '/galerie', '/intrebari-frecvente', '/contact', '/blog',
  '/confidentialitate', '/termeni-si-conditii', '/cookies',
  '/servicii/artificii-nunta', '/servicii/spectacole-drone',
  '/servicii/artificii-de-zi', '/servicii/efecte-speciale',
]);
const LEGAL_REDIRECTS = new Map([
  ['/legal/confidentialitate', '/confidentialitate'],
  ['/legal/termeni', '/termeni-si-conditii'],
  ['/legal/cookies', '/cookies'],
]);

async function defaultRender(url, data) {
  // Generated at build time. Lazy loading keeps imports and unit tests usable
  // before a build and never places server code or database access in the client.
  const { renderPublicPage } = require(path.join(ROOT, 'frontend/server-build/renderer.cjs'));
  return renderPublicPage(url, data);
}

function publicRequest(rawUrl) {
  if (typeof rawUrl !== 'string' || rawUrl.length > 8_192 || !/^\/(?!\/)/.test(rawUrl)
      || /[\\\x00-\x1f\x7f]/.test(rawUrl)) return null;
  const question = rawUrl.indexOf('?');
  let pathname = question === -1 ? rawUrl : rawUrl.slice(0, question);
  if (pathname.includes('#')) return null;
  const rawSearch = question === -1 ? '' : rawUrl.slice(question + 1);
  const params = new URLSearchParams(rawSearch);
  let redirectSearch = rawSearch;
  if (pathname === '/api/page') {
    const originalPaths = params.getAll('__fireart_path');
    if (originalPaths.length !== 1 || /[?#]/.test(originalPaths[0])) return null;
    pathname = originalPaths[0];
  }
  // Some runtime adapters preserve the source URL while adding rewrite query
  // parameters. On such requests the ordinary pathname stays authoritative.
  if (params.has('__fireart_path')) {
    params.delete('__fireart_path');
    params.delete('publicPath');
    redirectSearch = params.toString();
  }
  if (!/^\/(?!\/)/.test(pathname) || /[\\%\x00-\x20\x7f]/.test(pathname)) return null;
  const cleanPath = pathname.replace(/\/$/, '') || '/';
  if (LEGAL_REDIRECTS.has(cleanPath)) {
    return { redirect: `${LEGAL_REDIRECTS.get(cleanPath)}${redirectSearch ? `?${redirectSearch}` : ''}` };
  }
  const article = /^\/blog\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(cleanPath)
    && cleanPath.length <= 206;
  if (!PUBLIC_PATHS.has(cleanPath) && !article) return null;

  // Only the existing public filter parameters affect component rendering.
  // Tracking values and arbitrary query data never enter metadata or boot JSON.
  const renderParams = new URLSearchParams();
  for (const key of ['categorie', 'filtru']) {
    const values = params.getAll(key);
    if (values.length === 1 && values[0].length <= 100 && !/[\\\x00-\x1f\x7f]/.test(values[0])) {
      renderParams.set(key, values[0]);
    }
  }
  return {
    pathname: cleanPath,
    renderUrl: `${cleanPath}${renderParams.size ? `?${renderParams}` : ''}`,
    redirect: pathname !== cleanPath ? `${cleanPath}${redirectSearch ? `?${redirectSearch}` : ''}` : null,
  };
}

function stylesheetPaths(assets, pathname) {
  const key = pathname.startsWith('/blog/') ? '/blog/:slug'
    : pathname.startsWith('/servicii/') ? '/servicii/:slug' : pathname;
  return [...(Array.isArray(assets?.common) ? assets.common : []),
    ...(Array.isArray(assets?.routes?.[key]) ? assets.routes[key] : []),
    ...(key !== pathname && Array.isArray(assets?.routes?.[pathname]) ? assets.routes[pathname] : [])];
}

function errorDocument(status) {
  const title = status === 404 ? 'Pagina nu a fost găsită.' : status === 405
    ? 'Metodă nepermisă.' : 'Conținutul public nu este disponibil momentan.';
  return `<!doctype html><html lang="ro"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>${title} | FireArtRo</title></head><body><main><h1>${title}</h1><p><a href="/">FireArtRo</a></p></main></body></html>`;
}

function send(response, request, status, body) {
  response.statusCode = status;
  if (body !== undefined) response.setHeader('Content-Length', Buffer.byteLength(body));
  response.end(request.method === 'HEAD' ? undefined : body);
}

export function createPublicPageHandler({
  readData = readPublicPageData,
  render = defaultRender,
  readTemplate = () => readFile(path.join(ROOT, 'frontend/server-build/template.html'), 'utf8'),
  readAssets = async () => JSON.parse(await readFile(path.join(ROOT, 'frontend/build/public-page-assets.json'), 'utf8')),
} = {}) {
  return async function publicPageHandler(request, response) {
    response.setHeader('Content-Type', 'text/html; charset=utf-8');
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    const fail = status => {
      response.setHeader('X-Robots-Tag', 'noindex, nofollow');
      return send(response, request, status, errorDocument(status));
    };
    if (!['GET', 'HEAD'].includes(request.method)) {
      response.setHeader('Allow', 'GET, HEAD');
      return fail(405);
    }
    const route = publicRequest(request.url);
    if (!route) return fail(404);
    if (route.redirect) {
      response.setHeader('Location', route.redirect);
      return send(response, request, 308);
    }
    try {
      const [data, template, assets] = await Promise.all([
        readData(route.pathname), readTemplate(), readAssets(),
      ]);
      const result = await render(route.renderUrl, data);
      const html = publicPageDocument(template, result, { styles: stylesheetPaths(assets, route.pathname) });
      if (result.meta.noindex) response.setHeader('X-Robots-Tag', 'noindex, nofollow');
      return send(response, request, 200, html);
    } catch (error) {
      return fail(error?.status === 404 || error?.statusCode === 404 ? 404 : 503);
    }
  };
}
