import { act, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import useNearViewport from './useNearViewport';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const originalObserver = global.IntersectionObserver;
let root;
let container;
let observed;

function Scene() {
  const ref = useRef(null);
  const near = useNearViewport(ref);
  return <section ref={ref}>{near ? <p>Scene initialized</p> : <p>Scene waiting</p>}</section>;
}

beforeEach(() => {
  observed = [];
  global.IntersectionObserver = class {
    constructor(callback) { this.callback = callback; this.disconnected = false; observed.push(this); }
    observe(target) { this.target = target; }
    disconnect() { this.disconnected = true; }
  };
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  global.IntersectionObserver = originalObserver;
});

test('does not initialize an offscreen scene, initializes on approach and preserves it after exit', async () => {
  await act(async () => root.render(<Scene />));
  expect(container.textContent).toBe('Scene waiting');
  await act(async () => observed[0].callback([{ target: observed[0].target, isIntersecting: false }]));
  expect(container.textContent).toBe('Scene waiting');
  await act(async () => observed[0].callback([{ target: observed[0].target, isIntersecting: true }]));
  expect(container.textContent).toBe('Scene initialized');
  expect(observed[0].disconnected).toBe(true);
  await act(async () => observed[0].callback([{ target: observed[0].target, isIntersecting: false }]));
  expect(container.textContent).toBe('Scene initialized');
});

test('disconnects a waiting scene when navigating away', async () => {
  await act(async () => root.render(<Scene />));
  await act(async () => root.render(null));
  expect(observed[0].disconnected).toBe(true);
});

test('keeps content available when intersection observation is unsupported', async () => {
  delete global.IntersectionObserver;
  await act(async () => root.render(<Scene />));
  expect(container.textContent).toBe('Scene initialized');
});
