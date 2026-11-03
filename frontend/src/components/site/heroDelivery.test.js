import { selectHeroDelivery } from './heroDelivery';

test('uses the lightweight film on a measured weak 4G connection even on a Retina phone', () => {
  expect(selectHeroDelivery(390, 844, 3, { effectiveType: '4g', downlink: 1.5 }, 'portrait')).toBe('light');
  expect(selectHeroDelivery(1920, 1080, 2, { downlink: 2 })).toBe('light');
});

test('avoids a Retina download when bandwidth is moderate', () => {
  expect(selectHeroDelivery(390, 844, 3, { effectiveType: '4g', downlink: 4 }, 'portrait')).toBe('hd');
  expect(selectHeroDelivery(390, 844, 3, { effectiveType: '4g', downlink: 12 }, 'portrait')).toBe('retina');
});

test('reserves UHD for larger displays and uses the dedicated Retina encode on a 14-inch laptop', () => {
  expect(selectHeroDelivery(3840, 2160, 1)).toBe('uhd');
  expect(selectHeroDelivery(3440, 1440, 1)).toBe('uhd');
  expect(selectHeroDelivery(1728, 1117, 2)).toBe('uhd');
  expect(selectHeroDelivery(1512, 982, 2)).toBe('retina');
  expect(selectHeroDelivery(2560, 1440, 1)).toBe('retina');
  expect(selectHeroDelivery(1440, 900, 1)).toBe('hd');
});

test('uses Retina on fast portrait connections and HD when a phone cannot report bandwidth', () => {
  expect(selectHeroDelivery(430, 932, 3, { downlink: 12 }, 'portrait')).toBe('retina');
  expect(selectHeroDelivery(768, 1024, 2, { downlink: 12 }, 'portrait')).toBe('retina');
  expect(selectHeroDelivery(430, 932, 3, {}, 'portrait')).toBe('hd');
  expect(selectHeroDelivery(932, 430, 3, {}, 'wide')).toBe('hd');
  expect(selectHeroDelivery(390, 844, 1)).toBe('hd');
});

test('uses the lightweight film on 3G and keeps explicit data saving under the autoplay policy', () => {
  expect(selectHeroDelivery(3840, 2160, 1, { effectiveType: '3g' })).toBe('light');
  expect(selectHeroDelivery(3840, 2160, 1, { saveData: true })).toBe('hd');
});
