import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import GalleryPage from './GalleryPage';
import useManagedContent from '@/hooks/useManagedContent';

// Isolate unrelated network/widget effects; use the real gallery and dialog.
jest.mock('@/components/site/Navbar', () => () => null);
jest.mock('@/components/site/PageEnd', () => () => null);
jest.mock('@/components/site/ScrollProgress', () => () => null);
jest.mock('@/hooks/usePageMeta', () => () => {});
jest.mock('@/hooks/useManagedContent');

beforeEach(() => {
  useManagedContent.mockImplementation((key, fallback) => fallback);
});

test('does not render or publish media tagged ascuns-din-galerie', async () => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  const media = [
    { id: 'visible', type: 'image', category: 'Drone show', title: 'Formatie', alt: 'Formatie', src: '/visible.webp', tags: ['Drone'] },
    { id: 'hidden', type: 'image', category: 'Drone show', title: 'Nume pe cer', alt: 'Nume pe cer', src: '/hidden.webp', tags: ['ascuns-din-galerie'] },
  ];
  useManagedContent.mockImplementation((key, fallback) => key === 'mediaItems' ? media : fallback);
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  try {
    await act(async () => root.render(<MemoryRouter><GalleryPage /></MemoryRouter>));
    expect(container.querySelector('[data-media-id="visible"]')).not.toBeNull();
    expect(container.querySelector('[data-media-id="hidden"]')).toBeNull();
  } finally {
    await act(async () => root.unmount());
    container.remove();
    delete global.IS_REACT_ACT_ENVIRONMENT;
  }
});

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
