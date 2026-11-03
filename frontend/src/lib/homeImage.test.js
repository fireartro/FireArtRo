import { avifImageSrcSet, homeImageProps } from './homeImage';

test('uses the same existing portrait crops for package-card AVIF sources', () => {
  const src = '/media/gallery/fireartro-artificii-noapte-spectacol-110.webp';
  const avif = avifImageSrcSet(src);
  expect(avif).toContain('/media/optimized/pachet-artificii-noapte-640-20261103.avif 640w');
  expect(avif).toContain('/media/optimized/pachet-artificii-noapte-960-20261103.avif 960w');
  expect(avif).not.toContain('spectacol-110-640-20261103.avif');
});

test('uses the same promotional photograph derivatives at their existing widths', () => {
  expect(avifImageSrcSet('/media/gallery/spectacol-drone-focsani-fireartro-036.webp'))
    .toContain('/media/optimized/promovare-spectacol-drone-768-20261103.avif 768w');
});

test('retains the actual full-resolution drone photo for high-density homepage cards', () => {
  const src = '/media/gallery/spectacol-drone-mastercard-fireartro-076.webp';
  expect(homeImageProps(src).srcSet).toContain(`${src} 1800w`);
  expect(avifImageSrcSet(src)).toContain('/media/responsive/spectacol-drone-mastercard-fireartro-076-1800-20261103.avif 1800w');
});

test('delivers the dense gallery photo at card sizes while retaining the original source', () => {
  const src = '/media/gallery/spectacol-drone-ploiesti-fireartro-097.webp';
  const props = homeImageProps(src);
  expect(props.src).toBe(src);
  expect(props.srcSet).toContain('/media/responsive/spectacol-drone-ploiesti-fireartro-097-640-20261103.webp 640w');
  expect(props.srcSet).toContain(`${src} 1800w`);
});

test.each([
  '/media/gallery/spectacol-drone-ploiesti-fireartro-097.webp?v=owner-replacement',
  'https://example.com/media/gallery/spectacol-drone-ploiesti-fireartro-097.webp',
])('does not substitute bundled derivatives for an edited or remote photo: %s', src => {
  expect(homeImageProps(src)).toEqual({ src });
});

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
