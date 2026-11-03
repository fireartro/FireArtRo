import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import ResponsiveImage from './ResponsiveImage';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

test('offers AVIF with a WebP fallback and preserves image behavior and crop styling', () => {
  const container = document.createElement('div');
  const root = createRoot(container);
  const onLoad = jest.fn();
  const src = '/media/gallery/spectacol-drone-ploiesti-fireartro-097.webp';
  act(() => root.render(<ResponsiveImage src={src} alt="Drone la Ploiești" className="image-frame-media" sizes="320px" loading="lazy" style={{ objectPosition: '20% 70%' }} onLoad={onLoad} />));
  const img = container.querySelector('img');
  const source = container.querySelector('source');
  expect(source.type).toBe('image/avif');
  expect(source.srcset).toContain('-1280-20261103.avif 1280w');
  expect(source.sizes).toBe('320px');
  expect(img.getAttribute('src')).toBe(src);
  expect(img.srcset).toContain('-640-20261103.webp 640w');
  expect(img.alt).toBe('Drone la Ploiești');
  expect(img.className).toBe('image-frame-media');
  expect(img.style.objectPosition).toBe('20% 70%');
  act(() => img.dispatchEvent(new Event('load')));
  expect(onLoad).toHaveBeenCalledTimes(1);
  act(() => root.unmount());
});

test.each(['/uploads/owner-photo.webp', '/media/gallery/spectacol-drone-ploiesti-fireartro-097.webp?v=owner-edit'])('keeps owner uploads and replacements unchanged: %s', src => {
  const container = document.createElement('div');
  const root = createRoot(container);
  act(() => root.render(<ResponsiveImage src={src} alt="Fotografie proprie" />));
  expect(container.querySelector('source')).toBeNull();
  expect(container.querySelector('img').getAttribute('src')).toBe(src);
  expect(container.querySelector('img').getAttribute('srcset')).toBeNull();
  act(() => root.unmount());
});
