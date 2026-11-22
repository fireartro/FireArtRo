import { avifImageSrcSet, homeImageProps, responsiveImageProps } from '@/lib/homeImage';
import { useCookieConsent } from '@/lib/cookieConsent';
import { allowedGoogleMedia, isOptionalGoogleMedia, LOCAL_MEDIA_FALLBACK } from '@/lib/optionalGoogleMedia';

// The picture contributes no layout box: existing image classes, aspect
// ratios, crop controls and load handlers continue to belong to the img.
function RenderImage({ src, srcSet, sizes, ...props }) {
  const fallback = srcSet ? homeImageProps(src) : responsiveImageProps(src);
  const avif = avifImageSrcSet(src, { presets: Boolean(srcSet) });
  const image = <img {...fallback} {...props} srcSet={srcSet || fallback.srcSet} sizes={sizes || fallback.sizes} />;
  return avif
    ? <picture style={{ display: 'contents' }}><source type="image/avif" srcSet={avif} sizes={sizes || fallback.sizes || '100vw'} />{image}</picture>
    : image;
}

function OptionalGoogleImage({ src, srcSet, hasExternalSrcSet, ...props }) {
  const marketingAllowed = useCookieConsent()?.marketing === true;
  return <RenderImage {...props} src={allowedGoogleMedia(src, marketingAllowed, LOCAL_MEDIA_FALLBACK)}
    srcSet={hasExternalSrcSet && !marketingAllowed ? undefined : srcSet} />;
}

export default function ResponsiveImage({ src, srcSet, ...props }) {
  const hasExternalSrcSet = srcSet?.split(',').some(candidate => isOptionalGoogleMedia(candidate.trim().split(/\s+/, 1)[0]));
  return isOptionalGoogleMedia(src) || hasExternalSrcSet
    ? <OptionalGoogleImage {...props} src={src} srcSet={srcSet} hasExternalSrcSet={hasExternalSrcSet} />
    : <RenderImage {...props} src={src} srcSet={srcSet} />;
}
