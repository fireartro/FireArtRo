const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const html = readFileSync(path.resolve(__dirname, '../frontend/public/index.html'), 'utf8');

function bootstrap(pathname, fetch) {
  const source = html.match(/<script\s+src="%PUBLIC_URL%\/(site-bootstrap\.js(?:\?[^"<>]*)?)"\s*><\/script>/)?.[1];
  assert.ok(source, 'An early public-content bootstrap must exist');
  const script = readFileSync(path.resolve(__dirname, '../frontend/public', source.split('?')[0]), 'utf8');
  const window = {};
  const document = { documentElement: { dataset: {} }, readyState: 'loading', addEventListener() {} };
  vm.runInNewContext(script, { window, document, navigator: {}, location: { pathname }, fetch, Date, performance: { now: () => 0 }, setInterval: () => 1 });
  return window;
}
test('starts an anonymous public-only request and exposes its handled promise', async () => {
  const publication = { revision_id: 'live' };
  let calls = 0;
  const window = bootstrap('/galerie', async (url, options) => {
    calls++;
    assert.equal(url, '/api/content');
    assert.equal(options.credentials, 'omit');
    assert.equal(options.cache, 'no-cache');
    return { ok: true, json: async () => publication };
  });
  assert.equal(calls, 1);
  assert.deepEqual(await window.__fireartContentBoot.request, publication);
});
test('never prefetches for Admin or leaks an unhandled rejection on offline loads', async () => {
  for (const pathname of ['/admin', '/admin/']) {
    assert.equal(bootstrap(pathname, () => { throw new Error('Admin must not prefetch'); }).__fireartContentBoot, undefined);
  }
  const window = bootstrap('/', async () => { throw new Error('offline'); });
  assert.equal(await window.__fireartContentBoot.request, null);
});
