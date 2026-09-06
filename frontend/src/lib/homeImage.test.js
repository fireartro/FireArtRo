import { homeImageProps } from './homeImage';

test('delivers smaller existing gallery images with the full source available for large screens', () => {
  const src = '/media/gallery/fireartro-drone-show-focsani-dji-0768-enhanced-nr.webp';
  const props = homeImageProps(src);
  expect(props.src).toBe(src);
  expect(props.srcSet).toContain('/media/fireart-promo-drone-768.webp?v=20260906b 768w');
  expect(props.srcSet).toContain(`${src} 1800w`);
  expect(props.sizes).toBeTruthy();
});

test.each(['/uploads/new-photo.webp', 'https://example.com/photo.webp', '/media/gallery/fireartro-drone-show-focsani-dji-0768-enhanced-nr.webp?v=edited'])('keeps unmanaged or replaced CMS media untouched: %s', (src) => {
  expect(homeImageProps(src)).toEqual({ src });
});
