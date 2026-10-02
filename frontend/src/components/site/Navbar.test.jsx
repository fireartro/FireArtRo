import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { useReducedMotion } from 'framer-motion';
import Navbar from './Navbar';

jest.mock('@/hooks/useManagedContent', () => ({ __esModule: true, default: (_key, fallback) => fallback }));
// Observe the animation contract at the renderer boundary; no animation clock/browser.
jest.mock('framer-motion', () => {
  const React = require('react');
  const node = tag => React.forwardRef(({ initial, animate, transition, layoutId, ...props }, ref) => React.createElement(tag, { ...props, ref, 'data-initial': JSON.stringify(initial), 'data-animation': JSON.stringify(animate), 'data-transition': JSON.stringify(transition) }));
  return { useReducedMotion: jest.fn(), motion: { header: node('header'), span: node('span'), a: node('a') } };
});
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let root, container;
function Route() { return <output>{useLocation().pathname}</output>; }
beforeEach(() => {
  useReducedMotion.mockReturnValue(false);
  window.matchMedia = jest.fn(query => ({ matches: query.includes('pointer: fine'), addEventListener: jest.fn(), removeEventListener: jest.fn() }));
  jest.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => { callback(); return 1; });
  jest.spyOn(window, 'scrollTo').mockImplementation(() => {});
  container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); jest.restoreAllMocks(); });
const render = () => act(async () => root.render(<MemoryRouter initialEntries={['/contact']}><Navbar /><Route /></MemoryRouter>));
test.each([{ ctrlKey: true }, { metaKey: true }, { shiftKey: true }, { altKey: true }, { button: 1 }])('preserves native link behavior for a modified click %p', async modifiers => {
  await render();
  for (const link of [container.querySelector('[data-testid="nav-logo"]'), container.querySelector('.site-navbar-links a')]) {
    const event = new MouseEvent('click', { ...modifiers, bubbles: true, cancelable: true });
    await act(async () => link.dispatchEvent(event));
    expect(event.defaultPrevented).toBe(false);
    expect(container.querySelector('output').textContent).toBe('/contact');
  }
});
test('hides the header by its full own height after scrolling down', async () => {
  await render();
  Object.defineProperty(window, 'scrollY', { value: 200, configurable: true });
  await act(async () => window.dispatchEvent(new Event('scroll')));
  expect(JSON.parse(container.querySelector('header').dataset.animation).y).toBe('-100%');
  Object.defineProperty(window, 'scrollY', { value: 0, configurable: true });
});
test('reduced motion disables header entrance and displacement animation', async () => {
  useReducedMotion.mockReturnValue(true);
  await render();
  const header = container.querySelector('header');
  expect(JSON.parse(header.dataset.initial)).toBe(false);
  expect(JSON.parse(header.dataset.transition).duration).toBe(0);
});
test('logo source-size hint follows its rendered viewport geometry on resize', async () => {
  let width = 414;
  jest.spyOn(HTMLImageElement.prototype, 'getBoundingClientRect').mockImplementation(() => ({ width, height: 179, top: 0, left: 0, right: width, bottom: 179 }));
  await render();
  const logo = container.querySelector('[data-testid="nav-logo"] img');
  expect(logo.sizes).toBe('414px');
  width = 276;
  await act(async () => window.dispatchEvent(new Event('resize')));
  expect(logo.sizes).toBe('276px');
});

test('mobile menu keeps modified links native and removes entrance motion when reduced', async () => {
  useReducedMotion.mockReturnValue(true);
  await render();
  await act(async () => container.querySelector('[data-testid="mobile-menu-trigger"]').click());
  const link = document.querySelector('.mobile-nav-links a');
  const event = new MouseEvent('click', { ctrlKey: true, bubbles: true, cancelable: true });
  await act(async () => link.dispatchEvent(event));
  expect(event.defaultPrevented).toBe(false);
  expect(JSON.parse(link.dataset.initial)).toBe(false);
  expect(JSON.parse(link.dataset.transition).delay).toBe(0);
});

test('mobile menu has a bounded column and a shrinking scrollable link list', async () => {
  await render();
  await act(async () => container.querySelector('[data-testid="mobile-menu-trigger"]').click());
  const style = document.createElement('style');
  style.textContent = require('fs').readFileSync(require('path').join(process.cwd(), 'src/styles/navigation-prominence.css'), 'utf8');
  document.head.appendChild(style);
  try {
    const column = document.querySelector('.mobile-nav-sheet > div');
    expect(getComputedStyle(column).height).toBe('100%');
    expect(getComputedStyle(column).minHeight).toBe('0');
    expect(getComputedStyle(document.querySelector('.mobile-nav-links')).minHeight).toBe('0');
    expect(getComputedStyle(document.querySelector('.mobile-nav-links')).overflowY).toBe('auto');
  } finally { style.remove(); }
});
