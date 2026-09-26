const fs = require("fs");
const http = require("http");
const path = require("path");

const root = process.env.FIREART_PREVIEW_ROOT
  ? path.resolve(process.env.FIREART_PREVIEW_ROOT)
  : path.resolve(__dirname, "..", "build");
const port = Number(process.env.PORT || 4173);
const host = process.env.HOST || "127.0.0.1";
const contentOrigin = process.env.FIREART_PREVIEW_CONTENT_ORIGIN;

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mp4": "video/mp4",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webm": "video/webm",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

function resolveAsset(requestUrl) {
  const pathname = decodeURIComponent(new URL(requestUrl, `http://${host}:${port}`).pathname);
  const candidate = path.resolve(root, `.${pathname}`);
  const relative = path.relative(root, candidate);

  if (relative.startsWith("..") || path.isAbsolute(relative)) return null;
  if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;

  return path.join(root, "index.html");
}

const server = http.createServer(async (request, response) => {
  const pathname = new URL(request.url || "/", `http://${host}:${port}`).pathname;
  if (!['GET', 'HEAD'].includes(request.method)) {
    response.writeHead(405, { Allow: 'GET, HEAD' });
    response.end();
    return;
  }
  // Opt-in, public GET only: use the published CMS snapshot without exposing
  // local admin actions or forwarding credentials to the production API.
  const publicApi = pathname === '/api/content' || pathname === '/api/reviews'
    || /^\/api\/blog\/posts(?:\/[^/]+)?$/.test(pathname);
  if (publicApi && contentOrigin) {
    try {
      const upstreamUrl = new URL(contentOrigin);
      upstreamUrl.pathname = pathname;
      upstreamUrl.search = new URL(request.url, `http://${host}:${port}`).search;
      const upstream = await fetch(upstreamUrl, {
        signal: AbortSignal.timeout(10000),
      });
      const type = upstream.headers.get('content-type') || '';
      if (!type.includes('application/json')) throw new Error('Content API did not return JSON');
      const body = Buffer.from(await upstream.arrayBuffer());
      response.writeHead(upstream.status, { 'Content-Type': type, 'Cache-Control': 'no-store', 'Content-Length': body.length });
      response.end(request.method === 'HEAD' ? undefined : body);
    } catch {
      response.writeHead(502, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      response.end(JSON.stringify({ error: 'Published content is temporarily unavailable.' }));
    }
    return;
  }
  if (pathname.startsWith('/api/')) {
    response.writeHead(404, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ error: 'This local preview is read-only.' }));
    return;
  }
  let assetPath;
  try { assetPath = resolveAsset(request.url || '/'); }
  catch { response.writeHead(400); response.end(); return; }

  if (!assetPath || !fs.existsSync(assetPath)) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Build not found. Run the production build first.");
    return;
  }

  const size = fs.statSync(assetPath).size;
  const headers = {
    "Cache-Control": "no-store",
    "Content-Type": mimeTypes[path.extname(assetPath).toLowerCase()] || "application/octet-stream",
    "Accept-Ranges": "bytes",
    "Content-Length": size,
  };
  let start = 0;
  let end = size - 1;
  let status = 200;
  if (request.headers.range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(request.headers.range);
    if (match) {
      if (match[1]) {
        start = Number(match[1]);
        if (match[2]) end = Math.min(Number(match[2]), end);
      } else if (match[2]) start = Math.max(0, size - Number(match[2]));
    }
    if (!match || (!match[1] && !match[2]) || start > end || start >= size || !Number.isSafeInteger(start) || !Number.isSafeInteger(end)) {
      response.writeHead(416, { 'Content-Range': `bytes */${size}` });
      response.end();
      return;
    }
    status = 206;
    headers['Content-Range'] = `bytes ${start}-${end}/${size}`;
    headers['Content-Length'] = end - start + 1;
  }
  response.writeHead(status, headers);
  if (request.method === 'HEAD' || size === 0) { response.end(); return; }
  const stream = fs.createReadStream(assetPath, { start, end });
  stream.on('error', () => response.destroy());
  response.on('close', () => stream.destroy());
  stream.pipe(response);
});

server.listen(port, host, () => {
  process.stdout.write(`Night Runway preview: http://${host}:${server.address().port}\n`);
});
