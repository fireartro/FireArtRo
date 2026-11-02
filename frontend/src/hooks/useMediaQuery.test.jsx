import { act } from 'react';
import { renderToString } from 'react-dom/server';
import { hydrateRoot } from 'react-dom/client';
import { useIsMobile } from './useMediaQuery';

test('hydrates the server markup before applying the real mobile query without replacing it', async () => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  const previous = window.matchMedia;
  const listeners = new Set();
  const media = { matches: true, addEventListener: (_type, listener) => listeners.add(listener),
    removeEventListener: (_type, listener) => listeners.delete(listener) };
  window.matchMedia = () => media;
  const Probe = () => <span>{useIsMobile() ? 'mobile' : 'desktop'}</span>;
  const container = document.createElement('div');
  container.innerHTML = renderToString(<Probe />);
  const original = container.firstChild;
  const failures = [];
  let root;
  try {
    expect(original.textContent).toBe('desktop');
    await act(async () => { root = hydrateRoot(container, <Probe />, { onRecoverableError: error => failures.push(error) }); });
    expect(container.firstChild).toBe(original);
    expect(original.textContent).toBe('mobile');
    expect(failures).toEqual([]);
    act(() => { media.matches = false; listeners.forEach(listener => listener()); });
    expect(original.textContent).toBe('desktop');
  } finally {
    if (root) await act(async () => root.unmount());
    window.matchMedia = previous;
    delete global.IS_REACT_ACT_ENVIRONMENT;
  }
});
