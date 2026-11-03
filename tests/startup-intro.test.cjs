const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = readFileSync(path.resolve(__dirname, '../frontend/public/startup-intro.js'), 'utf8');

function start({ reduced = false, active = true, connection = {}, firstFilm = null, width = 1440, height = 900, dpr = 1 } = {}) {
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
    querySelector: selector => selector === 'button' ? button : null,
    contains: () => false,
    remove() { this.isConnected = false; }
  };
  const media = { video: null, playback: null, poster: { tagName: 'IMG', complete: true, naturalWidth: 1920 } };
  const hero = { querySelector: selector => selector === 'video' ? media.video
    : selector === '[data-hero-playback]' ? (media.playback ? { dataset: { heroPlayback: media.playback } } : null) : media.poster };
  const html = { dataset: active ? { fireartIntro: 'loading' } : {} };
  const document = {
    documentElement: html, hidden: false, activeElement: null,
    getElementById: id => ({ root, 'fireart-intro': intro, acasa: hero })[id],
    addEventListener, removeEventListener,
    querySelector: selector => selector.includes('picture') ? { currentSrc: '/media/optimized/test-selected-poster.webp' } : firstFilm,
  };
  const motion = { matches: reduced, addEventListener, removeEventListener };
  const window = { __fireartIntroStarted: 0, innerWidth: width, innerHeight: height, devicePixelRatio: dpr, location: { reload() { window.reloaded = true; } }, matchMedia: () => motion, addEventListener, removeEventListener, dispatchEvent: event => events.get(event.type)?.(event) };
  vm.runInNewContext(source, {
    window, document, navigator: { connection }, Event, performance: { now: () => now },
    setTimeout: (fn, delay) => timer(fn, delay), clearTimeout: id => tasks.delete(id),
    setInterval: (fn, delay) => timer(fn, delay, true), clearInterval: id => tasks.delete(id),
    requestAnimationFrame: () => 0, cancelAnimationFrame: () => {}
  });
  return { window, intro, root, media, html, button, tasks, events, advance };
}

function initialFilm() {
  const sources = Object.fromEntries(['wide', 'portrait'].map(format => [format,
    Object.fromEntries(['hd', 'retina', 'uhd'].map(quality => [quality,
      `/media/hero-film-${format}-1${quality === 'hd' ? '' : `-${quality}`}.mp4?v=test`]))]));
  return { dataset: {}, readyState: 4, canPlayType: () => 'probably',
    getAttribute: () => JSON.stringify(sources), classList: { add() {} },
    addEventListener() {}, removeEventListener() {} };
}

for (const [width, height, dpr, connection, expected] of [
  [390, 844, 1.75, {}, 'portrait-1.mp4'],
  [390, 844, 3, {}, 'portrait-1-retina.mp4'],
  [1920, 1080, 2, {}, 'wide-1-uhd.mp4'],
  [1920, 1080, 2, { effectiveType: '3g' }, 'wide-1.mp4'],
]) {
  test(`early buffer uses the same player rendition: ${expected}`, () => {
    const firstFilm = initialFilm();
    start({ firstFilm, width, height, dpr, connection });
    assert.ok(firstFilm.src.includes(expected));
    assert.equal(firstFilm.preload, 'auto');
    assert.equal(firstFilm.dataset.heroPrimed, 'true');
    assert.equal(firstFilm.poster, '/media/optimized/test-selected-poster.webp');
    assert.equal(firstFilm.dataset.heroPosterReady, 'true');
    assert.equal(firstFilm.dataset.mediaVariant, expected.startsWith('portrait') ? 'portrait' : 'wide');
    assert.equal(firstFilm.dataset.mediaQuality, expected.includes('-uhd') ? 'uhd' : expected.includes('-retina') ? 'retina' : 'hd');
  });
}

for (const options of [{ reduced: true }, { connection: { saveData: true } }]) {
  test(`early buffer respects explicit playback policy: ${JSON.stringify(options)}`, () => {
    const firstFilm = initialFilm();
    start({ firstFilm, ...options });
    assert.equal(firstFilm.src, undefined);
    assert.equal(firstFilm.preload, undefined);
  });
}

test('ready first video releases all input by 1.5 seconds', () => {
 const run=start();run.media.video={readyState:4,paused:false};
 run.window.__fireartIntro.routeReady('/');run.advance(1500);
 assert.equal(run.intro.isConnected,false);assert.equal(run.root.inert,false);assert.equal(run.tasks.size,0);
});

test('a loaded and painted native hero cover releases the reveal while its film buffers', () => {
  const run = start();
  run.media.playback = 'video';
  run.media.video = { readyState: 0, paused: true,
    poster: '/media/optimized/spectacol-artificii-panoramic-960-20261102.webp', dataset: { heroPosterReady: 'true' } };
  run.window.__fireartIntro.routeReady('/');
  run.advance(1299);
  assert.equal(run.intro.isConnected, true);
  run.advance(201);
  assert.equal(run.intro.isConnected, false);
  assert.equal(run.root.inert, false);
});

test('a video ready at 1.4 seconds still releases by the 1.5 second deadline', () => {
 const run=start();run.media.video={readyState:0,paused:true};
 run.window.__fireartIntro.routeReady('/');run.advance(1400);
 run.media.video.readyState=4;run.events.get('canplaythrough')();run.advance(100);
 assert.equal(run.intro.isConnected,false);assert.equal(run.root.inert,false);
});

test('a stalled hero automatically releases the poster and input after eight seconds', () => {
  const run = start();
  run.media.video = { readyState: 0, paused: true };
  run.window.__fireartIntro.routeReady('/');
  run.advance(8200);
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

test('reduced motion dismisses without an artificial wait', () => {
 const run=start({reduced:true});run.window.__fireartIntro.routeReady('/');run.advance(100);
 assert.equal(run.intro.isConnected,false);assert.equal(run.root.inert,false);
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
  run.media.playback = 'video';
  assert.equal(run.button.hidden, true);
  run.window.__fireartIntro.routeReady('/');
  assert.equal(run.button.hidden, true);
  run.advance(3000);
  assert.equal(run.button.hidden, false);
  run.events.get('click')();
  assert.equal(run.root.inert, false);
  assert.equal(run.intro.isConnected, false);
});

test('an already-ready interior page still remains covered for a brief reveal', () => {
  const run = start();
  run.window.__fireartIntro.routeReady('/galerie');
  run.advance(1299);
  assert.equal(run.html.dataset.fireartIntro, 'loading');
  run.advance(1);
  assert.equal(run.html.dataset.fireartIntro, 'leaving');
  run.advance(200);
  assert.equal(run.intro.isConnected, false);
});

test('a slow poster keeps its loading window and can finish before the stall deadline', () => {
  const run = start({ reduced: true });
  run.media.poster.complete = false;
  run.media.poster.naturalWidth = 0;
  run.window.__fireartIntro.routeReady('/');
  run.advance(5000);
  assert.equal(run.root.inert, true);
  run.media.poster.complete = true;
  run.media.poster.naturalWidth = 1920;
  run.advance(100);
  assert.equal(run.intro.isConnected, false);
  assert.equal(run.tasks.size, 0);
});

test('a 3g connection accepts future frames without waiting for canplaythrough', () => {
  const run = start({ connection: { effectiveType: '3g' } });
  run.media.playback = 'video';
  run.media.video = { readyState: 0, paused: true };
  run.window.__fireartIntro.routeReady('/');
  run.advance(2000);
  assert.equal(run.html.dataset.fireartIntro, 'loading');
  assert.equal(run.root.inert, true);
  run.media.video = { readyState: 2, paused: false };
  run.advance(1000);
  assert.equal(run.html.dataset.fireartIntro, 'loading');
  run.media.video = { readyState: 3, paused: false };
  run.advance(800);
  assert.equal(run.intro.isConnected, false);
  assert.equal(run.root.inert, false);
  assert.equal(run.tasks.size, 0);
});

test('does not mistake delayed video mounting for a poster-only hero', () => {
  const run = start();
  run.media.playback = 'video';
  run.window.__fireartIntro.routeReady('/');
  run.advance(3000);
  assert.equal(run.html.dataset.fireartIntro, 'loading');
  run.media.video = { readyState: 4, paused: false };
  run.advance(800);
  assert.equal(run.intro.isConnected, false);
});

test('an explicitly poster-only unsupported hero still exits without waiting for a video', () => {
  const run = start();
  run.media.playback = 'poster';
  run.window.__fireartIntro.routeReady('/');
  run.advance(1500);
  assert.equal(run.intro.isConnected, false);
});

test('a posterless custom video still is sufficient when playback is explicitly disabled', () => {
  const run = start({ connection: { saveData: true } });
  run.media.playback = 'poster';
  run.media.video = run.media.poster = { tagName: 'VIDEO', readyState: 2, paused: true };
  run.window.__fireartIntro.routeReady('/');
  run.advance(1500);
  assert.equal(run.intro.isConnected, false);
  assert.equal(run.root.inert, false);
});

test('a real video error overrides its expected playback when its poster also failed', () => {
  const run = start();
  run.media.playback = 'video';
  run.media.poster.naturalWidth = 0;
  run.media.video = { readyState: 0, paused: true, error: { code: 4 } };
  run.window.__fireartIntro.routeReady('/');
  run.advance(5000);
  assert.equal(run.intro.isConnected, false);
  assert.equal(run.root.inert, false);
});
