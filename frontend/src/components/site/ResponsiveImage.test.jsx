import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { COOKIE_CONSENT_STORAGE_KEY, saveCookieConsent } from '@/lib/cookieConsent';
import ResponsiveImage from './ResponsiveImage';

test('uses a first-party fallback for CMS YouTube thumbnails before marketing consent', async () => {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  try {
    await act(async () => root.render(
      <ResponsiveImage src="https://img.youtube.com/vi/AyU0-6KQJXc/hqdefault.jpg"
        srcSet="https://img.youtube.com/vi/AyU0-6KQJXc/maxresdefault.jpg 1200w" alt="Spectacol" />,
    ));
    expect(container.querySelector('img[alt="Spectacol"]')).not.toBeNull();
    for (const element of container.querySelectorAll('[src], [srcset]')) {
      expect(element.getAttribute('src') || '').not.toContain('youtube.com');
      expect(element.getAttribute('srcset') || '').not.toContain('youtube.com');
    }
    await act(async () => saveCookieConsent({ analytics: false, marketing: true }));
    expect(container.querySelector('img').getAttribute('src')).toContain('img.youtube.com');
    expect(container.querySelector('img').getAttribute('srcset')).toContain('img.youtube.com');
  } finally {
    await act(async () => root.unmount());
    container.remove();
    window.localStorage.removeItem(COOKIE_CONSENT_STORAGE_KEY);
    delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  }
});
