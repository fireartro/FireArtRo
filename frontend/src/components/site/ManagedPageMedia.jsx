import useManagedContent from "@/hooks/useManagedContent";
import { CMS_DEFAULTS } from "@/data/cmsDefaults";
import { useCookieConsent } from "@/lib/cookieConsent";
import { allowedGoogleMedia, LOCAL_MEDIA_FALLBACK } from "@/lib/optionalGoogleMedia";
import ResponsiveImage from './ResponsiveImage';

// Optional page media: an empty reference leaves the approved header untouched.
export default function ManagedPageMedia({ mediaId }) {
  const mediaItems = useManagedContent("mediaItems", CMS_DEFAULTS.mediaItems);
  const marketingAllowed = useCookieConsent()?.marketing === true;
  const media = mediaItems.find((item) => item.id === mediaId);
  if (!media) return null;
  const style = { width: "100%", maxHeight: "60vh", objectFit: "cover" };
  if (media.type === "video") {
    const src = allowedGoogleMedia(media.src, marketingAllowed);
    const poster = allowedGoogleMedia(media.poster, marketingAllowed, LOCAL_MEDIA_FALLBACK);
    return src
      ? <video src={src} poster={poster} controls playsInline preload="metadata" aria-label={media.alt} style={style} />
      : <ResponsiveImage src={poster || LOCAL_MEDIA_FALLBACK} alt={media.alt} style={style} />;
  }
  const image = <ResponsiveImage src={media.type === "youtube" ? media.poster || media.thumbnail : media.src} alt={media.alt} decoding="async" style={style} />;
  return media.type === "youtube"
    ? <a href={media.youtubeUrl} target="_blank" rel="noopener noreferrer">{image}</a>
    : image;
}
