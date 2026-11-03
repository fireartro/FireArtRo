import { avifImageSrcSet, homeImageProps, responsiveImageProps } from '@/lib/homeImage';

// The picture contributes no layout box: existing image classes, aspect
// ratios, crop controls and load handlers continue to belong to the img.
export default function ResponsiveImage({ src, srcSet, sizes, ...props }) {
  const fallback = srcSet ? homeImageProps(src) : responsiveImageProps(src);
  const avif = avifImageSrcSet(src, { presets: Boolean(srcSet) });
  const image = <img {...fallback} {...props} srcSet={srcSet || fallback.srcSet} sizes={sizes || fallback.sizes} />;
  return avif
    ? <picture style={{ display: 'contents' }}><source type="image/avif" srcSet={avif} sizes={sizes || fallback.sizes || '100vw'} />{image}</picture>
    : image;
}
