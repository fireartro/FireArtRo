import {act} from 'react';
import {createRoot} from 'react-dom/client';
import { COOKIE_CONSENT_STORAGE_KEY, OPEN_COOKIE_SETTINGS_EVENT, saveCookieConsent } from '@/lib/cookieConsent';
import PackageVideoPlayer from './PackageVideoPlayer';
jest.mock('framer-motion',()=>({useReducedMotion:()=>true}));
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
test('resetting crop keeps the explicitly selected package image instead of reverting to YouTube',async()=>{
  const container=document.createElement('div');document.body.append(container);const root=createRoot(container);
  const item={id:'one',title:'Pachet',videoUrl:'https://youtu.be/j2BGRd88qBc',moreVideoUrls:[],imageMediaId:'mine',mediaSelection:'manual'};
  try{
    await act(async()=>root.render(<PackageVideoPlayer item={{...item,imageFrame:{desktop:{x:20}}}} fallback="/mine.webp" label="Noapte"/>));
    expect(container.querySelector('img').getAttribute('src')).toBe('/mine.webp');
    await act(async()=>root.render(<PackageVideoPlayer item={{...item,imageFrame:null}} fallback="/mine.webp" label="Noapte"/>));
    expect(container.querySelector('img').getAttribute('src')).toBe('/mine.webp');
  }finally{await act(async()=>root.unmount());container.remove();}
});

test('uses local previews and keeps YouTube unloaded before a marketing choice', async () => {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  const item = {
    id: 'one', title: 'Pachet', videoUrl: 'https://youtu.be/j2BGRd88qBc',
    moreVideoUrls: ['https://youtu.be/AyU0-6KQJXc'],
  };
  const openSettings = jest.fn();
  window.addEventListener(OPEN_COOKIE_SETTINGS_EVENT, openSettings);
  try {
    await act(async () => root.render(<PackageVideoPlayer item={item} fallback="/mine.webp" label="Noapte" />));
    expect([...container.querySelectorAll('img')].map(image => image.getAttribute('src'))).toEqual([
      '/mine.webp', '/mine.webp', '/mine.webp',
    ]);
    await act(async () => container.querySelector('.nr-package-video-trigger').click());
    expect(openSettings).toHaveBeenCalledTimes(1);
    expect(container.querySelector('iframe')).toBeNull();
    await act(async () => saveCookieConsent({ analytics: true, marketing: false }));
    expect(container.querySelector('img').getAttribute('src')).toBe('/mine.webp');
    await act(async () => saveCookieConsent({ analytics: false, marketing: true }));
    expect(container.querySelector('iframe')).toBeNull();
    await act(async () => container.querySelector('.nr-package-video-trigger').click());
    expect(container.querySelector('iframe').getAttribute('src')).toContain('https://www.youtube-nocookie.com/embed/j2BGRd88qBc');
    await act(async () => saveCookieConsent({ analytics: false, marketing: false }));
    expect(container.querySelector('iframe')).toBeNull();
    expect(container.querySelector('img').getAttribute('src')).toBe('/mine.webp');
  } finally {
    await act(async () => root.unmount());
    container.remove();
    window.removeEventListener(OPEN_COOKIE_SETTINGS_EVENT, openSettings);
    window.localStorage.removeItem(COOKIE_CONSENT_STORAGE_KEY);
  }
});
