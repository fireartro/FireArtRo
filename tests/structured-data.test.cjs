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

test('the crawlable homepage schema identifies the FireArtRo organization logo', () => {
  const root = path.resolve(__dirname, '..');
  const html = fs.readFileSync(path.join(root, 'frontend/public/index.html'), 'utf8');
  const match = html.match(/<script id="page-structured-data" type="application\/ld\+json">\s*([\s\S]*?)\s*<\/script>/);

  assert.ok(match, 'missing crawlable homepage structured data');
  const graph = JSON.parse(match[1])['@graph'];
  const organization = graph.find((item) => (
    item['@type'] === 'Organization'
    || (Array.isArray(item['@type']) && item['@type'].includes('Organization'))
  ));

  assert.ok(organization, 'missing Organization entity');
  assert.equal(organization.logo, 'https://fireart.ro/icon-512.png');
});
