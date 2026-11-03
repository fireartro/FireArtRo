import { homeImageProps } from './homeImage';

test('delivers smaller existing gallery images with the full source available for large screens', () => {
  const src = '/media/gallery/spectacol-drone-focsani-fireartro-036.webp';
  const props = homeImageProps(src);
  expect(props.src).toBe(src);
  expect(props.srcSet).toContain('/media/promovare-spectacol-drone-768.webp?v=20260906b 768w');
  expect(props.srcSet).toContain(`${src} 1800w`);
  expect(props.sizes).toBeTruthy();
});

test.each(['/uploads/new-photo.webp', 'https://example.com/photo.webp', '/media/gallery/spectacol-drone-focsani-fireartro-036.webp?v=edited'])('keeps unmanaged or replaced CMS media untouched: %s', (src) => {
  expect(homeImageProps(src)).toEqual({ src });
});

test.each([
  '/media/gallery/fireartro-artificii-zi-spectacol-003.webp?v=source-crop-20260828',
  '/media/gallery/spectacol-drone-mastercard-fireartro-076.webp',
  '/media/gallery/fireartro-artificii-noapte-spectacol-110.webp',
])('offers responsive sizes for the bundled homepage photo: %s', src => {
  const props = homeImageProps(src);
  expect(props.src).toBe(src);
  expect(props.srcSet).toMatch(/\/media\/optimized\/[^ ]+ 640w/);
  expect(props.srcSet).toContain(`${src} `);
});
