import { act } from 'react';
import { createRoot } from 'react-dom/client';
import AdminPreview from './AdminPreview';

const mockLoadedPages = [];
let mockDraft = { siteDetails: { name: 'Unsaved draft' } };
jest.mock('./AdminDraftContext', () => ({ useAdminDraft: () => ({ draft: mockDraft }) }));
jest.mock('@/pages/Home', () => {
  mockLoadedPages.push('home');
  const { useManagedContentSnapshot } = require('@/content/ManagedContentProvider');
  return function HomeProbe() {
    const { content, preview } = useManagedContentSnapshot();
    return <p>{preview ? 'Draft: ' : 'Public: '}{content.siteDetails.name}</p>;
  };
});
jest.mock('@/pages/GalleryPage', () => {
  mockLoadedPages.push('gallery');
  const { useManagedContentSnapshot } = require('@/content/ManagedContentProvider');
  return function GalleryProbe() {
    return <p>Gallery: {useManagedContentSnapshot().content.siteDetails.name}</p>;
  };
});
jest.mock('@/pages/PackagesPage', () => { mockLoadedPages.push('packages'); return () => null; });
jest.mock('@/pages/FaqPage', () => { mockLoadedPages.push('faq'); return () => null; });
jest.mock('@/pages/ContactPage', () => { mockLoadedPages.push('contact'); return () => null; });
jest.mock('@/pages/BlogPage', () => { mockLoadedPages.push('blog'); return () => null; });

test('loads preview pages only when selected, preserving the latest draft and preview controls', async () => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement('div');
  const root = createRoot(container);
  const onClose = jest.fn();
  const render = async open => act(async () => root.render(<AdminPreview open={open} onClose={onClose} />));
  const click = async label => {
    const button = [...document.querySelectorAll('.cms-preview button')].find(item => item.textContent === label);
    await act(async () => button.dispatchEvent(new MouseEvent('click', { bubbles: true })));
  };
  try {
    await render(false);
    expect(mockLoadedPages).toEqual([]);
    expect(document.querySelector('.cms-preview')).toBeNull();

    await render(true);
    expect(mockLoadedPages).toEqual(['home']);
    expect(document.querySelector('.cms-preview-frame').textContent).toBe('Draft: Unsaved draft');
    expect(document.querySelector('.cms-preview-frame').hasAttribute('inert')).toBe(true);

    mockDraft = { siteDetails: { name: 'Latest draft edit' } };
    await render(true);
    expect(document.querySelector('.cms-preview-frame').textContent).toBe('Draft: Latest draft edit');
    await click('Galerie');
    expect(mockLoadedPages).toEqual(['home', 'gallery']);
    expect(document.querySelector('.cms-preview-frame').textContent).toBe('Gallery: Latest draft edit');
    await click('Telefon');
    expect(document.querySelector('.cms-preview-frame').classList.contains('is-phone')).toBe(true);
    await click('Închide');
    expect(onClose).toHaveBeenCalledTimes(1);

    await render(false);
    expect(document.querySelector('.cms-preview')).toBeNull();
    await render(true);
    expect(document.querySelector('.cms-preview-frame').textContent).toBe('Gallery: Latest draft edit');
    expect(document.querySelector('.cms-preview-frame').classList.contains('is-phone')).toBe(true);
    expect(mockLoadedPages).toEqual(['home', 'gallery']);
  } finally {
    await act(async () => root.unmount());
    delete global.IS_REACT_ACT_ENVIRONMENT;
  }
});
