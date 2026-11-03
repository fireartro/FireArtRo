import { useEffect, useRef } from 'react';
import { romanianImageUrl } from '@/lib/publicImageMetadata';

const posterSet = (format, widths) => widths.map(width =>
  `${romanianImageUrl(`/media/optimized/hero-${format}-${width}-20261102.webp`)} ${width}w`).join(', ');

// Picture selection happens in the HTML parser, including server-rendered pages.
// Its sources stay identical when the player chooses its video orientation.
export default function HeroPoster({ onReady, className }) {
  const image = useRef(null);
  useEffect(() => {
    if (image.current?.complete && image.current.naturalWidth > 0) onReady?.();
  }, [onReady]);
  return <picture data-hero-poster="responsive">
    <source media="(orientation: portrait)" type="image/webp"
      srcSet={posterSet('portrait', [480, 810, 1080])} sizes="100vw" />
    <source type="image/webp" srcSet={posterSet('wide', [960, 1440, 1920])} sizes="100vw" />
    <img ref={image} src="/media/optimized/spectacol-artificii-panoramic-1920-20261102.webp"
      onLoad={onReady} onError={onReady}
      alt="Spectacol real de artificii FireArtRo" width="1920" height="1080"
      className={className} fetchPriority="high" decoding="async" loading="eager" />
  </picture>;
}
