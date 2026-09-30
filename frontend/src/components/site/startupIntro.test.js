import fs from 'fs';
import path from 'path';

const introScript = fs.readFileSync(path.join(process.cwd(), 'public/startup-intro.js'), 'utf8');
const firstPaintSource = fs.readFileSync(path.join(process.cwd(), 'public/index.html'), 'utf8')
  .match(/<script\s+src="%PUBLIC_URL%\/(site-bootstrap\.js(?:\?[^"<>]*)?)"\s*><\/script>/)[1];
const firstPaintScript = fs.readFileSync(path.join(process.cwd(), 'public', firstPaintSource.split('?')[0]), 'utf8');
let strokes;
let clock;
beforeEach(() => {
  jest.useFakeTimers();
  document.documentElement.dataset.fireartIntro = 'loading';
  document.body.innerHTML = '<div id="root"></div><div id="fireart-intro"><canvas></canvas><button hidden>Intră</button></div>';
  window.__fireartIntroStarted = 0;
  clock = jest.spyOn(performance, 'now').mockReturnValue(1800);
  jest.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 1);
  jest.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
  Object.defineProperty(window, 'matchMedia', { configurable: true, value: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }) });
  strokes = [];
  // Canvas is not implemented in JSDOM. Record its drawing boundary while
  // executing the real first-paint controller, without mocking its algorithm.
  const pen = {
    createRadialGradient: () => ({ addColorStop() {} }),
    fillRect() {}, clearRect() {}, beginPath() {}, arc() {}, fill() {},
    moveTo() {}, lineTo() {}, drawImage() {}, save() {}, restore() {},
    translate() {}, scale() {}, setTransform() {},
    stroke() { strokes.push(this.strokeStyle); },
  };
  jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => pen);
});
afterEach(() => {
  window.__fireartIntro?.dismiss();
  delete window.__fireartIntroStarted;
  delete document.documentElement.dataset.fireartIntro;
  document.body.innerHTML = '';
  jest.restoreAllMocks();
  jest.useRealTimers();
});
const start = () => new Function(introScript)();

test('draws multiple distinct warm and cool firework trails rather than a monochrome burst', () => {
  start();
  const colors = [...new Set(strokes.map(value => value.match(/^rgba\((\d+),(\d+),(\d+),/)?.slice(1).map(Number).join(',')))].filter(Boolean);
  expect(colors.length).toBeGreaterThanOrEqual(4);
  expect(colors.some(color => { const [r,,b] = color.split(',').map(Number); return b > r + 30; })).toBe(true);
  expect(colors.some(color => { const [r,,b] = color.split(',').map(Number); return r > b + 30; })).toBe(true);
});

test('keeps the loading screen visible for at least three seconds when content is ready immediately', () => {
  clock.mockReturnValue(0);
  start();
  window.__fireartIntro.contentReady();
  window.__fireartIntro.routeReady('/contact');
  jest.advanceTimersByTime(2999);
  expect(document.documentElement.dataset.fireartIntro).toBe('loading');
  expect(document.getElementById('root').hasAttribute('inert')).toBe(true);
  jest.advanceTimersByTime(1);
  expect(document.documentElement.dataset.fireartIntro).toBe('leaving');
  expect(document.getElementById('root').hasAttribute('inert')).toBe(true);
  jest.advanceTimersByTime(680);
  expect(document.getElementById('root').hasAttribute('inert')).toBe(false);
});

test.each(['wheel', 'touchmove', 'keydown'])('blocks %s scrolling until the intro is removed, including its exit fade', type => {
  clock.mockReturnValue(0);
  start();
  const gesture = () => type === 'keydown'
    ? new KeyboardEvent(type, { key: 'PageDown', bubbles: true, cancelable: true })
    : new Event(type, { bubbles: true, cancelable: true });
  const before = gesture();
  document.dispatchEvent(before);
  expect(before.defaultPrevented).toBe(true);
  window.__fireartIntro.routeReady('/contact');
  jest.advanceTimersByTime(3000);
  const leaving = gesture();
  document.dispatchEvent(leaving);
  expect(leaving.defaultPrevented).toBe(true);
  jest.advanceTimersByTime(680);
  const after = gesture();
  document.dispatchEvent(after);
  expect(after.defaultPrevented).toBe(false);
});

test('does not block Tab or Enter and releases scroll guards on explicit skip', () => {
  start();
  for (const key of ['Tab', 'Enter']) {
    const event = new KeyboardEvent('keydown', { key, cancelable: true });
    document.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
  }
  window.__fireartIntro.dismiss();
  const wheel = new Event('wheel', { cancelable: true });
  document.dispatchEvent(wheel);
  expect(wheel.defaultPrevented).toBe(false);
});

test.each([false, true])('keeps native Space activation available with first-paint guard=%s', firstPaint => {
  if (firstPaint) {
    new Function('fetch', firstPaintScript)(async () => ({ ok: false }));
    const before = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true });
    document.querySelector('#fireart-intro button').dispatchEvent(before);
    expect(before.defaultPrevented).toBe(false);
  }
  start();
  const event = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true });
  document.querySelector('#fireart-intro button').dispatchEvent(event);
  expect(event.defaultPrevented).toBe(false);
});

test('announces dismissal once, only after the document is unlocked', () => {
  const states = [];
  const onDismiss = () => states.push({
    intro: document.getElementById('fireart-intro'),
    locked: document.getElementById('root').hasAttribute('inert'),
    phase: document.documentElement.dataset.fireartIntro,
  });
  window.addEventListener('fireart:intro-dismissed', onDismiss);
  try {
    start();
    window.__fireartIntro.dismiss();
    expect(states).toEqual([{ intro: null, locked: false, phase: undefined }]);
    jest.advanceTimersByTime(15000);
    expect(states).toHaveLength(1);
  } finally {
    window.removeEventListener('fireart:intro-dismissed', onDismiss);
  }
});
