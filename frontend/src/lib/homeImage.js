// Only immutable bundled originals have derived sizes. Admin uploads and
// versioned replacements retain their exact published URL.
const variants = {
  '/media/gallery/fireartro-drone-show-focsani-dji-0768-enhanced-nr.webp': ['drone', 1800],
  '/media/gallery/fireartro-artificii-noapte-spectacol-091.webp': ['night', 1600],
  '/media/gallery/fireartro-artificii-zi-festival-biserica.webp': ['day', 1920],
};

export function homeImageProps(src) {
  const variant = variants[src];
  if (!variant) return { src };
  const [name, width] = variant;
  return {
    src,
    srcSet: `/media/fireart-promo-${name}-768.webp?v=20260906b 768w, /media/fireart-promo-${name}-1152.webp?v=20260906b 1152w, ${src} ${width}w`,
    sizes: '(max-width: 899px) 100vw, clamp(704px, 56vw, 1152px)',
  };
}
