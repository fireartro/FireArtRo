import { act, StrictMode } from 'react';
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

describe('modal lifecycle', () => {
  let container;
  let background;
  let opener;
  let root;
  let onClose;
  let extraSiblings;

  const dialog = () => document.querySelector('[role="dialog"]');
  const button = label => [...dialog().querySelectorAll('button')].find(item => item.textContent === label);
  const render = async (open = true, close = onClose, strict = false) => {
    const preview = <AdminPreview open={open} onClose={close} />;
    await act(async () => root.render(strict ? <StrictMode>{preview}</StrictMode> : preview));
  };
  const press = (key, target = document.activeElement, shiftKey = false) => {
    const event = new KeyboardEvent('keydown', { key, shiftKey, bubbles: true, cancelable: true });
    target.dispatchEvent(event);
    return event;
  };
  const addSibling = (inertValue = null) => {
    const sibling = document.createElement('section');
    if (inertValue !== null) sibling.setAttribute('inert', inertValue);
    document.body.append(sibling);
    extraSiblings.push(sibling);
    return sibling;
  };

  beforeEach(() => {
    global.IS_REACT_ACT_ENVIRONMENT = true;
    mockDraft = { siteDetails: { name: 'Unsaved draft' } };
    container = document.createElement('div');
    background = document.createElement('div');
    opener = document.createElement('button');
    opener.textContent = 'Open preview';
    background.append(opener);
    document.body.append(background, container);
    root = createRoot(container);
    onClose = jest.fn();
    extraSiblings = [];
    opener.focus();
  });

  afterEach(async () => {
    if (root) await act(async () => root.unmount());
    container.remove();
    background.remove();
    extraSiblings.forEach(sibling => sibling.remove());
    jest.restoreAllMocks();
    delete global.IS_REACT_ACT_ENVIRONMENT;
  });

  test('places initial focus inside the body portal and keeps preview content inert', async () => {
    await render();

    expect(dialog().parentElement).toBe(document.body);
    expect(dialog().contains(document.activeElement)).toBe(true);
    expect(dialog().getAttribute('aria-modal')).toBe('true');
    expect(document.getElementById(dialog().getAttribute('aria-labelledby')).textContent).toBe('Previzualizare draft');
    expect(document.querySelector('.cms-preview-frame').hasAttribute('inert')).toBe(true);
  });

  test('wraps Tab and Shift+Tab between the first and last usable controls', async () => {
    await render();
    const first = button('Acasă');
    const last = button('Închide');
    last.focus();

    expect(press('Tab').defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(first);
    expect(press('Tab', first, true).defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(last);

    button('Galerie').focus();
    expect(press('Tab').defaultPrevented).toBe(false);
    expect(press('Tab', document.activeElement, true).defaultPrevented).toBe(false);
  });

  test.each([false, true])('recovers Tab when focus falls back to the document body (shift=%s)', async shift => {
    await render();
    document.activeElement.blur();
    expect(document.activeElement).toBe(document.body);

    expect(press('Tab', document.body, shift).defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(button(shift ? 'Închide' : 'Acasă'));
  });

  test('recovers programmatically escaped focus to the last focused modal control', async () => {
    await render();
    const gallery = button('Galerie');
    gallery.focus();
    opener.focus();

    expect(document.activeElement).toBe(gallery);
  });

  test('excludes inert preview content and disabled controls from focus recovery and trapping', async () => {
    await render();
    const previewButton = document.createElement('button');
    previewButton.textContent = 'Read-only preview action';
    document.querySelector('.cms-preview-frame').append(previewButton);
    button('Galerie').focus();
    previewButton.focus();
    expect(document.activeElement).toBe(button('Galerie'));

    button('Acasă').disabled = true;
    button('Închide').focus();
    press('Tab');
    expect(document.activeElement).toBe(button('Galerie'));
  });

  test('uses the dialog as a focus fallback when no usable controls remain', async () => {
    await render();
    dialog().querySelectorAll('button').forEach(control => { control.disabled = true; });
    opener.focus();

    expect(document.activeElement).toBe(dialog());
    expect(press('Tab').defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(dialog());
  });

  test('invokes the latest onClose for Escape without restarting focus or capturing a new opener', async () => {
    await render();
    const gallery = button('Galerie');
    gallery.focus();
    const nextOnClose = jest.fn();
    mockDraft = { siteDetails: { name: 'Updated while open' } };
    await render(true, nextOnClose);
    expect(document.activeElement).toBe(gallery);

    expect(press('Escape').defaultPrevented).toBe(true);
    expect(nextOnClose).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
    await render(false, nextOnClose);
    expect(document.activeElement).toBe(opener);
  });

  test('makes body siblings inert and restores absent, empty and nonempty attribute values on close', async () => {
    const absent = addSibling();
    const empty = addSibling('');
    const custom = addSibling('previous-inert-value');
    await render();

    [container, background, absent, empty, custom].forEach(sibling => {
      expect(sibling.hasAttribute('inert')).toBe(true);
    });
    expect(dialog().hasAttribute('inert')).toBe(false);
    expect(dialog().closest('[inert]')).toBeNull();

    await render(false);
    expect(container.getAttribute('inert')).toBeNull();
    expect(background.getAttribute('inert')).toBeNull();
    expect(absent.getAttribute('inert')).toBeNull();
    expect(empty.getAttribute('inert')).toBe('');
    expect(custom.getAttribute('inert')).toBe('previous-inert-value');
    expect(document.activeElement).toBe(opener);
  });

  test('protects new body siblings and restores their original values even after removal and reinsertion', async () => {
    await render();
    let added;
    let custom;
    await act(async () => {
      added = addSibling();
      custom = addSibling('late-inert-value');
    });
    expect(added.hasAttribute('inert')).toBe(true);
    expect(custom.hasAttribute('inert')).toBe(true);

    await act(async () => added.remove());
    added.removeAttribute('inert');
    await act(async () => document.body.append(added));
    expect(added.hasAttribute('inert')).toBe(true);
    custom.remove();
    await render(false);
    expect(added.getAttribute('inert')).toBeNull();
    expect(custom.getAttribute('inert')).toBe('late-inert-value');
  });

  test('restores the connected opener and background when unmounted while open', async () => {
    await render();
    button('Galerie').focus();
    await act(async () => root.unmount());
    root = null;

    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(background.hasAttribute('inert')).toBe(false);
    expect(document.activeElement).toBe(opener);
  });

  test('does not try to restore focus to a disconnected opener', async () => {
    await render();
    opener.remove();
    const focus = jest.spyOn(opener, 'focus');
    await render(false);

    expect(focus).not.toHaveBeenCalled();
    expect(background.hasAttribute('inert')).toBe(false);
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });

  test('does not activate the modal lifecycle while closed or while the draft is missing', async () => {
    await render(false);
    expect(background.hasAttribute('inert')).toBe(false);
    expect(document.activeElement).toBe(opener);
    press('Escape');
    expect(onClose).not.toHaveBeenCalled();

    mockDraft = null;
    await render();
    expect(dialog()).toBeNull();
    expect(background.hasAttribute('inert')).toBe(false);
    expect(document.activeElement).toBe(opener);
  });

  test('cleans up the active modal when its draft disappears', async () => {
    await render();
    button('Galerie').focus();
    mockDraft = null;
    await render();

    expect(dialog()).toBeNull();
    expect(document.activeElement).toBe(opener);
    expect(background.hasAttribute('inert')).toBe(false);
    press('Escape');
    expect(onClose).not.toHaveBeenCalled();
  });

  test.each(['close', 'unmount'])('removes listeners and disconnects the observer on %s', async action => {
    const addListener = jest.spyOn(document, 'addEventListener');
    const removeListener = jest.spyOn(document, 'removeEventListener');
    const disconnect = jest.spyOn(MutationObserver.prototype, 'disconnect');
    await render();
    const modalListeners = addListener.mock.calls.filter(([type]) => type === 'keydown' || type === 'focusin');
    expect(modalListeners.map(([type]) => type).sort()).toEqual(['focusin', 'keydown']);

    if (action === 'close') {
      await render(false);
    } else {
      await act(async () => root.unmount());
      root = null;
    }
    modalListeners.forEach(args => expect(removeListener).toHaveBeenCalledWith(...args));
    expect(disconnect).toHaveBeenCalledTimes(1);
    press('Escape', opener);
    expect(onClose).not.toHaveBeenCalled();
    const outside = document.createElement('button');
    background.append(outside);
    outside.focus();
    expect(document.activeElement).toBe(outside);
    let added;
    await act(async () => { added = addSibling(); });
    expect(added.hasAttribute('inert')).toBe(false);
  });

  test('reopens cleanly under StrictMode and restores each opening trigger', async () => {
    const custom = addSibling('strict-prior-value');
    await render(true, onClose, true);
    expect(dialog().contains(document.activeElement)).toBe(true);
    expect(background.hasAttribute('inert')).toBe(true);
    await render(false, onClose, true);
    expect(document.activeElement).toBe(opener);
    expect(custom.getAttribute('inert')).toBe('strict-prior-value');

    const nextOpener = document.createElement('button');
    background.append(nextOpener);
    nextOpener.focus();
    await render(true, onClose, true);
    expect(dialog().contains(document.activeElement)).toBe(true);
    press('Escape');
    expect(onClose).toHaveBeenCalledTimes(1);
    await render(false, onClose, true);
    expect(document.activeElement).toBe(nextOpener);
    expect(background.hasAttribute('inert')).toBe(false);
    expect(custom.getAttribute('inert')).toBe('strict-prior-value');
  });
});
