import { selectHeroDelivery } from './heroDelivery';

test('serves the UHD rendition on a 4K screen and on a Retina laptop', () => {
  expect(selectHeroDelivery(3840, 2160, 1)).toBe('uhd');
  expect(selectHeroDelivery(1512, 982, 2)).toBe('uhd');
  expect(selectHeroDelivery(1440, 900, 1)).toBe('hd');
});

test('accounts for device pixels in portrait without treating CSS size as resolution', () => {
  expect(selectHeroDelivery(430, 932, 3, {}, 'portrait')).toBe('retina');
  expect(selectHeroDelivery(768, 1024, 2, {}, 'portrait')).toBe('retina');
  expect(selectHeroDelivery(390, 844, 1)).toBe('hd');
});

test('uses HD on explicitly constrained connections', () => {
  expect(selectHeroDelivery(3840, 2160, 1, { effectiveType: '3g' })).toBe('hd');
  expect(selectHeroDelivery(3840, 2160, 1, { saveData: true })).toBe('hd');
});
