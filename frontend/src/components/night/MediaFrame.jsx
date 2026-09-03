import { cn } from "@/lib/utils";

export default function MediaFrame({
  src,
  alt = "",
  video = false,
  poster,
  className,
  children,
  priority = false,
  ...props
}) {
  return (
    <figure className={cn("nr-media", className)} {...props}>
      <span className="nr-media__corner nr-media__corner--top" aria-hidden="true" />
      {video ? (
        <video
          src={src}
          poster={poster}
          autoPlay
          muted
          loop
          playsInline
          preload={priority ? "auto" : "metadata"}
          aria-label={alt || undefined}
        />
      ) : (
        <img src={src} alt={alt} loading={priority ? "eager" : "lazy"} decoding="async" />
      )}
      <span className="nr-media__scan" aria-hidden="true" />
      {children}
    </figure>
  );
}
