const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = readFileSync(path.resolve(__dirname, '../frontend/public/startup-intro.js'), 'utf8');

function start({ reduced = false, active = true } = {}) {
  let now = 0;
  let nextId = 1;
  const tasks = new Map();
  const events = new Map();
  const addEventListener = (name, fn) => events.set(name, fn);
  const removeEventListener = (name, fn) => { if (events.get(name) === fn) events.delete(name); };
  const timer = (fn, delay, interval = false) => {
    const id = nextId++;
    tasks.set(id, { fn, at: now + delay, delay, interval });
    return id;
  };
  const advance = delta => {
    const end = now + delta;
    while (true) {
      const next = [...tasks].filter(([, task]) => task.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
      if (!next) break;
      const [id, task] = next;
      now = task.at;
      if (task.interval) task.at += task.delay;
      else tasks.delete(id);
      task.fn();
    }
    now = end;
  };
  const root = { inert: false, setAttribute() { this.inert = true; }, removeAttribute() { this.inert = false; } };
  const button = { hidden: true, addEventListener, removeEventListener };
  const intro = {
    dataset: {}, isConnected: true,
    querySelector: selector => selector === 'canvas' ? { getContext: () => null } : button,
    contains: () => false,
    remove() { this.isConnected = false; }
  };
  const media = { video: null, poster: { tagName: 'IMG', complete: true, naturalWidth: 1920 } };
  const hero = { querySelector: selector => selector === 'video' ? media.video : media.poster };
  const html = { dataset: active ? { fireartIntro: 'loading' } : {} };
  const document = {
    documentElement: html, hidden: false, activeElement: null,
    getElementById: id => ({ root, 'fireart-intro': intro, acasa: hero })[id],
    addEventListener, removeEventListener
  };
  const motion = { matches: reduced, addEventListener, removeEventListener };
  const window = { __fireartIntroStarted: 0, innerWidth: 1440, innerHeight: 900, location: { reload() { window.reloaded = true; } }, matchMedia: () => motion, addEventListener, removeEventListener };
  vm.runInNewContext(source, {
    window, document, navigator: {}, performance: { now: () => now },
    setTimeout: (fn, delay) => timer(fn, delay), clearTimeout: id => tasks.delete(id),
    setInterval: (fn, delay) => timer(fn, delay, true), clearInterval: id => tasks.delete(id),
    requestAnimationFrame: () => 0, cancelAnimationFrame: () => {}
  });
  return { window, intro, root, media, html, button, tasks, events, advance };
}

test('waits for the first playable frame, then releases input and all timers', () => {
  const run = start();
  run.window.__fireartIntro.contentReady();
  run.window.__fireartIntro.routeReady('/');
  run.advance(1200);
  assert.equal(run.root.inert, true);
  assert.equal(run.html.dataset.fireartIntro, 'loading');
  run.media.video = { readyState: 2, paused: false };
  run.advance(100);
  assert.equal(run.html.dataset.fireartIntro, 'loading');
  run.advance(1699);
  assert.equal(run.root.inert, true);
  run.advance(1);
  assert.equal(run.html.dataset.fireartIntro, 'leaving');
  assert.equal(run.root.inert, false);
  run.advance(700);
  assert.equal(run.intro.isConnected, false);
  assert.equal(run.tasks.size, 0);
  assert.equal(run.events.size, 0);
});

test('a slow playable video keeps loading beyond twelve seconds, even with a ready poster', () => {
  const run = start();
  run.media.video = { readyState: 0, paused: true };
  run.window.__fireartIntro.routeReady('/');
  run.advance(20000);
  assert.equal(run.html.dataset.fireartIntro, 'loading');
  assert.equal(run.root.inert, true);
  run.media.video = { readyState: 2, paused: false };
  run.advance(800);
  assert.equal(run.intro.isConnected, false);
  assert.equal(run.root.inert, false);
});

test('failed poster and failed video cannot trap a visitor', () => {
  const run = start();
  run.media.poster.naturalWidth = 0;
  run.window.__fireartIntro.routeReady('/');
  run.advance(5800);
  assert.equal(run.intro.isConnected, false);
  assert.equal(run.root.inert, false);
});

test('reduced motion keeps the three-second minimum without animating the exit', () => {
  const run = start({ reduced: true });
  run.window.__fireartIntro.routeReady('/');
  run.advance(2999);
  assert.equal(run.root.inert, true);
  run.advance(1);
  assert.equal(run.intro.isConnected, false);
  assert.equal(run.root.inert, false);
  assert.equal(run.tasks.size, 0);
});

test('Admin and failed publication dismiss the overlay immediately', () => {
  for (const action of ['admin', 'unavailable']) {
    const run = start();
    if (action === 'admin') run.window.__fireartIntro.routeReady('/admin');
    else run.window.__fireartIntro.dismiss();
    assert.equal(run.intro.isConnected, false);
    assert.equal(run.root.inert, false);
  }
  const admin = start({ active: false });
  assert.equal(admin.intro.isConnected, false);
  assert.equal(admin.tasks.size, 0);
});

test('a slow app stays covered after twelve seconds and offers a deliberate retry', () => {
  const run = start();
  run.advance(12000);
  assert.equal(run.intro.isConnected, true);
  assert.equal(run.root.inert, true);
  assert.equal(run.button.hidden, false);
  run.events.get('click')();
  assert.equal(run.window.reloaded, true);
});

test('skip is available only after the route mounts and releases focus blocking', () => {
  const run = start();
  assert.equal(run.button.hidden, true);
  run.window.__fireartIntro.routeReady('/');
  assert.equal(run.button.hidden, true);
  run.advance(3000);
  assert.equal(run.button.hidden, false);
  run.events.get('click')();
  assert.equal(run.root.inert, false);
  assert.equal(run.intro.isConnected, false);
});

test('an already-ready interior page still remains covered for three seconds', () => {
  const run = start();
  run.window.__fireartIntro.routeReady('/galerie');
  run.advance(2999);
  assert.equal(run.html.dataset.fireartIntro, 'loading');
  run.advance(1);
  assert.equal(run.html.dataset.fireartIntro, 'leaving');
  run.advance(680);
  assert.equal(run.intro.isConnected, false);
});

test('a slow poster is not treated as a failed image and can finish after twenty seconds', () => {
  const run = start({ reduced: true });
  run.media.poster.complete = false;
  run.media.poster.naturalWidth = 0;
  run.window.__fireartIntro.routeReady('/');
  run.advance(20000);
  assert.equal(run.root.inert, true);
  run.media.poster.complete = true;
  run.media.poster.naturalWidth = 1920;
  run.advance(100);
  assert.equal(run.intro.isConnected, false);
  assert.equal(run.tasks.size, 0);
});
