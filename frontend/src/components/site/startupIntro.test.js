import fs from 'fs';
import path from 'path';

const introScript = fs.readFileSync(path.join(process.cwd(), 'public/startup-intro.js'), 'utf8');
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
  expect(document.getElementById('root').hasAttribute('inert')).toBe(false);
});
