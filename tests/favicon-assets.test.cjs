const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const publicDir = path.resolve(__dirname, '../frontend/public');

test('the public document exposes FireArtRo icons for browsers and installed shortcuts', () => {
  const html = fs.readFileSync(path.join(publicDir, 'index.html'), 'utf8');
  const manifest = JSON.parse(fs.readFileSync(path.join(publicDir, 'site.webmanifest'), 'utf8'));

  assert.match(html, /rel="icon"[^>]+href="%PUBLIC_URL%\/favicon\.ico"/);
  assert.match(html, /rel="icon"[^>]+type="image\/svg\+xml"[^>]+href="%PUBLIC_URL%\/favicon\.svg"/);
  assert.match(html, /rel="apple-touch-icon"[^>]+href="%PUBLIC_URL%\/apple-touch-icon\.png"/);
  assert.match(html, /rel="manifest"[^>]+href="%PUBLIC_URL%\/site\.webmanifest"/);
  assert.equal(manifest.name, 'FireArtRo');
  assert.deepEqual(manifest.icons.map((icon) => icon.sizes), ['192x192', '512x512']);
  for (const asset of ['favicon.svg', 'favicon.ico', 'favicon-32x32.png', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png']) {
    assert.ok(fs.existsSync(path.join(publicDir, asset)), `missing ${asset}`);
  }
});
