import catalogue from '@/data/importedGalleryItems.json';
import { isGalleryVisible } from './categoryNavigation';

export const HOME_PACKAGE_IMAGE_IDS = {
  'Artificii de noapte': 'gallery-import-110',
  'Artificii de zi': 'gallery-import-003',
  'Show drone': 'gallery-import-drone-076',
  'Efecte speciale': 'gallery-import-019',
};
const galleryImageIds = {
  'Artificii de noapte': 'gallery-import-070',
  'Artificii de zi': 'gallery-import-008',
  'Drone show': 'gallery-import-drone-021',
};
const originals = new Map(catalogue.map(item => [item.id, item]));
const pathOf = src => { try { return new URL(src, 'https://fireart.ro').pathname; } catch { return src; } };

export function selectHomeGallery(slides, items) {
  const byId = new Map(items.map(item => [item.id, item]));
  const used = new Set(Object.values(HOME_PACKAGE_IMAGE_IDS).flatMap(id => [
    originals.get(id)?.src, byId.get(id)?.src,
  ]).filter(Boolean).map(pathOf));
  return slides.flatMap(slide => {
    let media = byId.get(slide.mediaId);
    if (slide.type === 'youtube') return [{ ...slide, media }];
    if (!media) return [];
    if (used.has(pathOf(media.src)) || !isGalleryVisible(media)) {
      const fallbackId = galleryImageIds[media.category];
      const fallback = byId.get(fallbackId) || originals.get(fallbackId);
      media = fallback && isGalleryVisible(fallback) && !used.has(pathOf(fallback.src)) ? fallback
        : items.find(item => item.type === 'image' && item.category === media.category && isGalleryVisible(item) && !used.has(pathOf(item.src)));
    }
    if (!media) return [];
    used.add(pathOf(media.src));
    return [{ ...slide, mediaId: media.id, media }];
  });
}
