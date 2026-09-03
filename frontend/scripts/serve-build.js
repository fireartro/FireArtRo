const fs = require("fs");
const http = require("http");
const path = require("path");

const root = path.resolve(__dirname, "..", "build");
const port = Number(process.env.PORT || 4173);
const host = process.env.HOST || "127.0.0.1";

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

const server = http.createServer((request, response) => {
  const assetPath = resolveAsset(request.url || "/");

  if (!assetPath || !fs.existsSync(assetPath)) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Build not found. Run the production build first.");
    return;
  }

  response.writeHead(200, {
    "Cache-Control": assetPath.endsWith("index.html") ? "no-store" : "public, max-age=31536000, immutable",
    "Content-Type": mimeTypes[path.extname(assetPath).toLowerCase()] || "application/octet-stream",
  });
  fs.createReadStream(assetPath).pipe(response);
});

server.listen(port, host, () => {
  process.stdout.write(`Night Runway preview: http://${host}:${port}\n`);
});
