import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import GalleryPage from './GalleryPage';

// Isolate unrelated network/widget effects; use the real gallery and dialog.
jest.mock('@/components/site/Navbar', () => () => null);
jest.mock('@/components/site/PageEnd', () => () => null);
jest.mock('@/components/site/ScrollProgress', () => () => null);
jest.mock('@/hooks/usePageMeta', () => () => {});

test('defers offscreen thumbnails without delaying the first group or a selected full-size image', async () => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  try {
    await act(async () => root.render(<MemoryRouter><GalleryPage /></MemoryRouter>));
    const thumbnails = [...container.querySelectorAll('.nr-gallery-card img')];
    expect(thumbnails.length).toBeGreaterThan(20);
    expect(thumbnails.slice(0, 8).every(img => img.getAttribute('loading') === 'eager')).toBe(true);
    expect(thumbnails.slice(8).every(img => img.getAttribute('loading') === 'lazy')).toBe(true);
    await act(async () => container.querySelector('.nr-gallery-card button').click());
    const fullSize = document.querySelector('.nr-gallery-lightbox__media img');
    expect(fullSize).not.toBeNull();
    expect(fullSize.getAttribute('loading')).toBe('eager');
  } finally {
    await act(async () => root.unmount());
    container.remove();
    delete global.IS_REACT_ACT_ENVIRONMENT;
  }
});
