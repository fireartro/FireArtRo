const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

test('the static schema is replaced by route-specific structured data after hydration', () => {
  const root = path.resolve(__dirname, '..');
  const html = fs.readFileSync(path.join(root, 'frontend/public/index.html'), 'utf8');
  const pageMeta = fs.readFileSync(path.join(root, 'frontend/src/hooks/usePageMeta.js'), 'utf8');

  assert.match(html, /<script id="page-structured-data" type="application\/ld\+json">/);
  assert.match(pageMeta, /const schemaId = "page-structured-data"/);
});
