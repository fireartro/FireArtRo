import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { useReducedMotion } from 'framer-motion';
import HomeGallery from './HomeGallery';
import { gsap } from 'gsap';

jest.mock('@/hooks/useManagedContent', () => ({ __esModule: true, default: (_key, fallback) => fallback }));
jest.mock('framer-motion', () => ({ useReducedMotion: jest.fn(() => false) }));
jest.mock('gsap', () => ({ gsap: { registerPlugin: jest.fn(), context: jest.fn(() => ({ revert: jest.fn() })) } }));
jest.mock('gsap/ScrollTrigger', () => ({ ScrollTrigger: {} }));
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let root, container, compact, listener;
beforeEach(() => {
  compact = true; listener = undefined;
  gsap.context.mockImplementation(() => ({ revert: jest.fn() }));
  window.matchMedia = jest.fn(query => ({ matches: query.includes('max-height: 640px') && compact, addEventListener: (_event, handler) => { if (query.includes('max-height: 640px')) listener = handler; }, removeEventListener: jest.fn() }));
  container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
});

test('static gallery layout releases its clipped viewport and preserves horizontal access', async () => {
  useReducedMotion.mockReturnValue(true);
  await render();
  const style = document.createElement('style');
  style.textContent = require('fs').readFileSync(require('path').join(process.cwd(), 'src/styles/night-home-film.css'), 'utf8');
  document.head.appendChild(style);
  try {
    const sticky = getComputedStyle(container.querySelector('.fa-work__sticky'));
    const viewport = getComputedStyle(container.querySelector('.fa-work__viewport'));
    expect(sticky.blockSize).toBe('auto');
    expect(viewport.height).toBe('auto');
    expect(viewport.overflowX).toBe('auto');
  } finally { style.remove(); }
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); useReducedMotion.mockReturnValue(false); });
const render = () => act(async () => root.render(<MemoryRouter><HomeGallery /></MemoryRouter>));
test('short desktop gallery uses a static scrollable scene and responds to viewport changes', async () => {
  await render();
  expect(container.querySelector('[data-testid="home-gallery"]').dataset.motion).toBe('static');
  expect(listener).toBeDefined();
  await act(async () => { compact = false; listener({ matches: false }); });
  expect(container.querySelector('[data-testid="home-gallery"]').dataset.motion).toBe('scroll');
});
test('gallery image hints use lazy automatic sizing with an uncapped large viewport fallback', async () => {
  await render();
  const image = container.querySelector('img[srcset]');
  expect(image).not.toBeNull();
  expect(image.loading || image.getAttribute('loading')).toBe('lazy');
  expect(image.sizes).toMatch(/^auto, /);
  expect(image.sizes).toContain('78vw');
});
