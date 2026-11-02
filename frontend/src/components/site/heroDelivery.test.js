import { selectHeroDelivery } from './heroDelivery';

test('reserves UHD for larger displays and uses the dedicated Retina encode on a 14-inch laptop', () => {
  expect(selectHeroDelivery(3840, 2160, 1)).toBe('uhd');
  expect(selectHeroDelivery(3440, 1440, 1)).toBe('uhd');
  expect(selectHeroDelivery(1728, 1117, 2)).toBe('uhd');
  expect(selectHeroDelivery(1512, 982, 2)).toBe('retina');
  expect(selectHeroDelivery(2560, 1440, 1)).toBe('retina');
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
