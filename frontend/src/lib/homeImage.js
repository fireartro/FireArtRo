// Only immutable bundled originals have derived sizes. Admin uploads and
// versioned replacements retain their exact published URL.
import { romanianImageUrl } from './publicImageMetadata';
import responsiveImages from '@/data/responsiveImages.json';
import presetImages from '@/data/responsivePresetImages.json';

export function avifImageSrcSet(src, { presets = true } = {}) {
  src = romanianImageUrl(src);
  if (presets && (optimized[src] || variants[src])) {
    // These existing responsive files can have reviewed crops of their own.
    // Convert those exact files rather than substituting an uncropped photo.
    return homeImageProps(src).srcSet.split(', ').flatMap(candidate => {
      const [url, descriptor] = candidate.split(' ');
      const width = Number.parseInt(descriptor, 10);
      const image = presetImages[url.split('?')[0]]
        || responsiveImages[src]?.avif.find(item => item.width === width);
      return image ? [`${image.src} ${descriptor}`] : [];
    }).join(', ') || undefined;
  }
  return responsiveImages[src]?.avif.map(item => `${item.src} ${item.width}w`).join(', ') || undefined;
}

export function responsiveImageProps(src) {
  src = romanianImageUrl(src);
  const image = responsiveImages[src];
  if (!image?.webp.length) return { src };
  return {
    src,
    srcSet: image.webp.map(item => `${item.src} ${item.width}w`).concat(`${src} ${image.width}w`).join(', '),
    sizes: '(max-width: 899px) 100vw, clamp(704px, 56vw, 1152px)',
  };
}
const variants = {
  '/media/gallery/spectacol-drone-focsani-fireartro-036.webp': ['drone', 1800],
  '/media/gallery/fireartro-artificii-noapte-spectacol-091.webp': ['night', 1600],
  '/media/gallery/fireartro-artificii-zi-festival-biserica.webp': ['day', 1920],
  '/media/gallery/fireartro-artificii-noapte-spectacol-110.webp': ['owner-night', 1280],
  '/media/gallery/fireartro-artificii-zi-spectacol-008.webp': ['owner-day', 1576],
  '/media/gallery/spectacol-drone-baia-mare-fireartro-021.webp': ['owner-drone', 1800],
  '/media/gallery/fireartro-nunta-spectacol-019.webp': ['owner-effects', 1920],
};

const optimized = {
  '/media/gallery/fireartro-artificii-zi-spectacol-003.webp?v=source-crop-20260828': ['package-day', 1080],
  '/media/gallery/spectacol-drone-mastercard-fireartro-076.webp': ['package-drone', 1411],
  '/media/gallery/fireartro-artificii-noapte-spectacol-110.webp': ['package-night', 1280],
  '/media/gallery/fireartro-nunta-spectacol-019.webp': ['package-effects', 1920],
};

export function homeImageProps(src) {
  src = romanianImageUrl(src);
  if (optimized[src]) {
    const [name, width] = optimized[src];
    return { src, srcSet: [480, 640, 960].map(size =>
      `${romanianImageUrl(`/media/optimized/${name}-${size}-20261102.webp`)} ${size}w`).concat(`${src} ${responsiveImages[src]?.width || width}w`).join(', '),
      sizes: '(max-width: 899px) 100vw, clamp(704px, 56vw, 1152px)' };
  }
  const variant = variants[src];
  if (!variant) return responsiveImageProps(src);
  const [name, width] = variant;
  return {
    src,
    srcSet: `${romanianImageUrl(`/media/fireart-promo-${name}-768.webp?v=20260906b`)} 768w, ${romanianImageUrl(`/media/fireart-promo-${name}-1152.webp?v=20260906b`)} 1152w, ${src} ${responsiveImages[src]?.width || width}w`,
    sizes: '(max-width: 899px) 100vw, clamp(704px, 56vw, 1152px)',
  };
}
