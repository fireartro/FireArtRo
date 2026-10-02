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

test.each(['/galerie', '/galerie?media=visible'])('restores a useful gallery focus target after closing a photo from %s', async route => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  const media = [
    { id: 'visible', type: 'image', category: 'Drone show', title: 'Formatie', alt: 'Formatie', src: '/visible.webp' },
  ];
  useManagedContent.mockImplementation((key, fallback) => key === 'mediaItems' ? media : fallback);
  const container = document.createElement('div'); document.body.appendChild(container);
  const root = createRoot(container);
  try {
    await act(async () => root.render(<MemoryRouter initialEntries={[route]}><GalleryPage /></MemoryRouter>));
    const opener = container.querySelector('.nr-gallery-card button');
    if (!route.includes('?')) { opener.focus(); await act(async () => opener.click()); }
    const close = document.querySelector('.nr-gallery-lightbox > button');
    await act(async () => { close.click(); await new Promise(resolve => setTimeout(resolve, 10)); });
    expect(document.activeElement).toBe(route.includes('?') ? container.querySelector('[role="tab"][aria-selected="true"]') : opener);
  } finally { await act(async () => root.unmount()); container.remove(); delete global.IS_REACT_ACT_ENVIRONMENT; }
});

test('gallery tabs expose their controlled labelled panel after category changes', async () => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement('div'); document.body.appendChild(container);
  const root = createRoot(container);
  try {
    await act(async () => root.render(<MemoryRouter><GalleryPage /></MemoryRouter>));
    const tabs = [...container.querySelectorAll('[role="tab"]')];
    for (const tab of [tabs[0], tabs[tabs.length - 1]]) {
      await act(async () => tab.click());
      expect(tab.id).not.toBe('');
      const panel = document.getElementById(tab.getAttribute('aria-controls'));
      expect(panel).not.toBeNull();
      expect(panel.getAttribute('role')).toBe('tabpanel');
      expect(panel.getAttribute('aria-labelledby')).toBe(tab.id);
    }
  } finally { await act(async () => root.unmount()); container.remove(); delete global.IS_REACT_ACT_ENVIRONMENT; }
});
