import useManagedContent from "@/hooks/useManagedContent";
import { CMS_DEFAULTS } from "@/data/cmsDefaults";

// Optional page media: an empty reference leaves the approved header untouched.
export default function ManagedPageMedia({ mediaId }) {
  const mediaItems = useManagedContent("mediaItems", CMS_DEFAULTS.mediaItems);
  const media = mediaItems.find((item) => item.id === mediaId);
  if (!media) return null;
  const style = { width: "100%", maxHeight: "60vh", objectFit: "cover" };
  if (media.type === "video") {
    return <video src={media.src} poster={media.poster} controls playsInline preload="metadata" aria-label={media.alt} style={style} />;
  }
  const image = <img src={media.type === "youtube" ? media.poster || media.thumbnail : media.src} alt={media.alt} decoding="async" style={style} />;
  return media.type === "youtube"
    ? <a href={media.youtubeUrl} target="_blank" rel="noopener noreferrer">{image}</a>
    : image;
}
