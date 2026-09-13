import { selectHomeGallery, HOME_PACKAGE_IMAGE_IDS } from './homeMediaSelection';
import catalogue from '@/data/importedGalleryItems.json';
test('keeps package and gallery photographs distinct even in an old CMS publication', () => {
  const slides = Object.values(HOME_PACKAGE_IMAGE_IDS).map(mediaId => ({ type: 'image', mediaId }));
  const chosen = selectHomeGallery(slides, catalogue);
  expect(chosen).toHaveLength(4);
  expect(new Set(chosen.map(x => x.media.src)).size).toBe(4);
  chosen.forEach(x => expect(Object.values(HOME_PACKAGE_IMAGE_IDS)).not.toContain(x.mediaId));
});
test('retains a unique custom CMS photograph and ignores a missing slide', () => {
  const image = { id: 'custom', src: '/custom.webp', type: 'image', category: 'Drone show' };
  expect(selectHomeGallery([{ type: 'image', mediaId: 'custom' }, { type: 'image', mediaId: 'missing' }], [image])).toEqual([{ type: 'image', mediaId: 'custom', media: image }]);
});
