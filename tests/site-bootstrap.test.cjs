const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const publicDir = path.resolve(__dirname, '../frontend/public');

function start({ pathname = '/', navigator = {}, readyState = 'loading' } = {}) {
  const html = readFileSync(path.join(publicDir, 'index.html'), 'utf8');
  const sourcePath = html.match(/<script\s+src="%PUBLIC_URL%\/(site-bootstrap\.js(?:\?[^"<>]*)?)"\s*><\/script>/)?.[1];
  assert.ok(sourcePath, 'Startup must run from a blocking same-origin script, not inline code');
  const source = readFileSync(path.join(publicDir, sourcePath.split('?')[0]), 'utf8');
  const handlers = new Map();
  const timers = new Map();
  const events = [];
  const window = { dispatchEvent: event => events.push(event.type) };
  const root = { inert: true, removeAttribute() { this.inert = false; } };
  const intro = { removed: false, remove() { this.removed = true; } };
  const document = {
    readyState, documentElement: { dataset: {} },
    addEventListener: (type, handler) => handlers.set(type, handler),
    removeEventListener: (type, handler) => { if (handlers.get(type) === handler) handlers.delete(type); },
    getElementById: id => ({ root, 'fireart-intro': intro })[id],
  };
  const requests = [];
  vm.runInNewContext(source, {
    window, document, location: { pathname }, navigator, performance: { now: () => 0 }, Date, Event,
    fetch: async (...args) => { requests.push(args); return { ok: true, json: async () => ({ revision_id: 'published' }) }; },
    setInterval: handler => { timers.set(1, handler); return 1; }, clearInterval: id => timers.delete(id),
  });
  return { window, document, handlers, timers, events, root, intro, requests };
}

test('locks scroll immediately and does not mistake a slow document for a failed startup', () => {
  const run = start();
  assert.equal(run.document.documentElement.dataset.fireartIntro, 'loading');
  let prevented = false;
  run.handlers.get('wheel')({ type: 'wheel', cancelable: true, preventDefault() { prevented = true; } });
  assert.equal(prevented, true);
  run.timers.get(1)();
  assert.equal(run.root.inert, true);
  assert.equal(run.intro.removed, false);
  run.document.readyState = 'complete';
  run.timers.get(1)();
  assert.equal(run.root.inert, false);
  assert.equal(run.intro.removed, true);
  assert.equal(run.handlers.size, 0);
  assert.equal(run.timers.size, 0);
  assert.equal(run.window.__fireartIntroScrollGuard, undefined);
  assert.deepEqual(run.events, ['fireart:intro-dismissed']);
});

test('does not lock or prefetch Admin, but retains Safari platform detection', () => {
  for (const pathname of ['/admin', '/admin/']) {
    const run = start({ pathname, navigator: { userAgent: 'Version/18 Safari/605', platform: 'MacIntel', maxTouchPoints: 0 } });
    assert.equal(run.requests.length, 0);
    assert.equal(run.handlers.size, 0);
    assert.equal(run.timers.size, 0);
    assert.equal(run.document.documentElement.dataset.fireartIntro, undefined);
    assert.equal(run.document.documentElement.dataset.applePlatform, 'true');
    assert.equal(run.document.documentElement.dataset.appleWebkit, 'true');
  }
});

test('retains early public prefetch and keyboard access to the loading-screen skip control', async () => {
  const run = start();
  assert.equal(run.requests.length, 1);
  const [url, options] = run.requests[0];
  assert.equal(url, '/api/content');
  assert.equal(options.credentials, 'omit');
  assert.equal(options.cache, 'no-cache');
  assert.equal((await run.window.__fireartContentBoot.request).revision_id, 'published');
  let prevented = false;
  run.handlers.get('keydown')({ type: 'keydown', key: ' ', target: { closest: () => true }, cancelable: true, preventDefault() { prevented = true; } });
  assert.equal(prevented, false);
});
