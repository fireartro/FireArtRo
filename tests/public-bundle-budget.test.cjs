const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const buildDir = path.resolve(__dirname, '../frontend/build/static');

function mainAsset(directory, extension) {
  const assetDir = path.join(buildDir, directory);
  const matches = fs.readdirSync(assetDir)
    .filter((name) => name.startsWith('main.') && name.endsWith(extension));

  assert.equal(matches.length, 1, `expected one main ${extension} asset`);
  return path.join(assetDir, matches[0]);
}

test('the render-blocking public stylesheet stays within its launch budget', () => {
  const cssBytes = fs.statSync(mainAsset('css', '.css')).size;
  assert.ok(cssBytes <= 320_000, `main CSS is ${cssBytes} bytes; budget is 320000`);
});

test('the initial public JavaScript stays within its launch budget', () => {
  const jsBytes = fs.statSync(mainAsset('js', '.js')).size;
  assert.ok(jsBytes <= 940_000, `main JS is ${jsBytes} bytes; budget is 940000`);
});

test('the deployment has no static homepage that could bypass runtime HTML rendering', () => {
  const frontend = path.resolve(__dirname, '../frontend');
  assert.equal(fs.existsSync(path.join(frontend, 'build/index.html')), false);
  const template = fs.readFileSync(path.join(frontend, 'server-build/template.html'), 'utf8');
  assert.match(template, /<div id="root"><\/div>/);
  const admin = fs.readFileSync(path.join(frontend, 'build/admin-shell.html'), 'utf8');
  assert.match(admin, /name="robots" content="noindex, nofollow"/);
});

test('every public route has its compiled stylesheet available for initial HTML', () => {
  const build = path.resolve(__dirname, '../frontend/build');
  const manifest = JSON.parse(fs.readFileSync(path.join(build, 'public-page-assets.json'), 'utf8'));
  for (const route of ['/', '/pachete', '/galerie', '/contact', '/intrebari-frecvente', '/blog', '/blog/:slug', '/servicii/:slug', '/cookies', '/confidentialitate', '/termeni-si-conditii']) {
    assert.ok(manifest.routes[route]?.length, `Missing CSS for ${route}`);
    for (const css of manifest.routes[route]) assert.ok(fs.existsSync(path.join(build, css)), css);
  }
});
