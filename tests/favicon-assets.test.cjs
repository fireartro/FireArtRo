const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const publicDir = path.resolve(__dirname, '../frontend/public');

function pngSize(asset) {
  const bytes = fs.readFileSync(path.join(publicDir, asset));
  assert.equal(bytes.subarray(1, 4).toString('ascii'), 'PNG');
  return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
}

test('the public document exposes FireArtRo icons for browsers and installed shortcuts', () => {
  const html = fs.readFileSync(path.join(publicDir, 'index.html'), 'utf8');
  const manifest = JSON.parse(fs.readFileSync(path.join(publicDir, 'site.webmanifest'), 'utf8'));

  assert.match(html, /rel="icon"[^>]+href="%PUBLIC_URL%\/favicon\.ico"/);
  assert.match(html, /rel="icon"[^>]+type="image\/png"[^>]+href="%PUBLIC_URL%\/favicon-16x16\.png"[^>]+sizes="16x16"/);
  assert.match(html, /rel="icon"[^>]+type="image\/png"[^>]+href="%PUBLIC_URL%\/favicon-32x32\.png"[^>]+sizes="32x32"/);
  assert.match(html, /rel="apple-touch-icon"[^>]+href="%PUBLIC_URL%\/apple-touch-icon\.png"/);
  assert.match(html, /rel="manifest"[^>]+href="%PUBLIC_URL%\/site\.webmanifest"/);
  assert.equal(manifest.name, 'FireArtRo');
  assert.deepEqual(manifest.icons.map((icon) => icon.sizes), ['192x192', '512x512']);
  for (const asset of ['favicon.ico', 'favicon-16x16.png', 'favicon-32x32.png', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png']) {
    assert.ok(fs.existsSync(path.join(publicDir, asset)), `missing ${asset}`);
  }
  assert.equal(fs.existsSync(path.join(publicDir, 'favicon.svg')), false);
  assert.deepEqual(pngSize('favicon-16x16.png'), [16, 16]);
  assert.deepEqual(pngSize('favicon-32x32.png'), [32, 32]);
  assert.deepEqual(pngSize('apple-touch-icon.png'), [180, 180]);
  assert.deepEqual(pngSize('icon-192.png'), [192, 192]);
  assert.deepEqual(pngSize('icon-512.png'), [512, 512]);

  const ico = fs.readFileSync(path.join(publicDir, 'favicon.ico'));
  assert.equal(ico.readUInt16LE(2), 1, 'favicon.ico must be an icon');
  assert.equal(ico.readUInt16LE(4), 3, 'favicon.ico must contain 16, 32 and 48 px variants');
});
