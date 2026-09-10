import { useEffect, useRef, useState } from "react";
import HeroKineticTitles from "./HeroKineticTitles";
import { HERO_MEDIA, HERO_POSTER } from "@/data/content";
import {
  canPlayHeroVideo,
  getHeroAutoplayPolicy,
  scheduleHeroVideoPlayback,
  selectHeroSource,
} from "./heroPlayback";

// Choose one composition atomically from the CSS viewport. Independent media
// query updates can briefly select an intermediate source during rotation.
const readMediaVariant = () => {
  if (typeof window === "undefined") return "wide";
  const ratio = window.innerWidth / Math.max(1, window.innerHeight);
  if (ratio <= 1) {
    if (ratio <= 0.5) return "mobile-tall";
    return ratio >= 0.6 ? "tablet-portrait" : "mobile";
  }
  if (ratio <= 1.5) return "tablet-landscape";
  return ratio >= 2 ? "ultrawide" : "wide";
};

export const HeroVideo = ({ mediaOverride }) => {
  const videoRef = useRef(null);
  const viewportRef = useRef(null);
  const [pageVisible, setPageVisible] = useState(
    () => typeof document === "undefined" || document.visibilityState !== "hidden",
  );
  const [mediaVariant, setMediaVariant] = useState(readMediaVariant);
  const media = mediaOverride || HERO_MEDIA.variants[mediaVariant] || HERO_MEDIA.variants.wide;
  const [delivery, setDelivery] = useState(null);
  const needsCodecChoice = !mediaOverride && Boolean(media.av1Src)
    && typeof navigator !== 'undefined' && typeof navigator.mediaCapabilities?.decodingInfo === 'function';
  const source = !mediaOverride && delivery?.original === media.src ? delivery.src : media.src;
  const codecReady = !needsCodecChoice || delivery?.original === media.src;
  const poster = media.poster || HERO_POSTER;
  const objectPosition = HERO_MEDIA.position || "50% 50%";
  const [videoFailed, setVideoFailed] = useState(false);
  const [bundledVideoSupported] = useState(() => typeof document === "undefined"
    || canPlayHeroVideo(document.createElement("video")));
  const [autoplayEligible, setAutoplayEligible] = useState(
    () => typeof window === "undefined" || getHeroAutoplayPolicy(window),
  );
  const [activatedSource, setActivatedSource] = useState("");
  const [readyPoster, setReadyPoster] = useState("");
  const isVideoMedia = !mediaOverride || mediaOverride.type === "video";
  const canMountVideo = isVideoMedia
    && codecReady
    && !videoFailed
    && (Boolean(mediaOverride) || bundledVideoSupported || source === media.av1Src)
    && autoplayEligible;
  const usePoster = !canMountVideo || activatedSource !== source;
  const fallbackImage = mediaOverride && mediaOverride.type !== "video"
    ? (mediaOverride.type === "youtube" ? poster : source)
    : poster;
  const customVideoStill = usePoster && mediaOverride?.type === "video" && !mediaOverride.poster;
  const videoPoster = mediaOverride?.type === "video" && !mediaOverride.poster ? undefined : poster;

  useEffect(() => {
    if (!needsCodecChoice || !autoplayEligible) return undefined;
    let cancelled = false;
    selectHeroSource(media, navigator).then(src => {
      if (!cancelled) setDelivery({ original: media.src, src });
    });
    return () => { cancelled = true; };
  }, [media, needsCodecChoice, autoplayEligible]);

  useEffect(() => {
    const updateVariant = () => {
      const next = { width: window.innerWidth, height: window.innerHeight };
      const previous = viewportRef.current;
      viewportRef.current = next;
      const mobileViewport = next.width <= 768 || window.navigator?.maxTouchPoints > 0;
      const heightOnly = previous && previous.width === next.width
        && (previous.width <= previous.height) === (next.width <= next.height);
      // Browser toolbars and the keyboard resize the visible mobile viewport.
      // Keep the selected file/decoder; a real width change or rotation still
      // selects the appropriate composition atomically.
      if (mobileViewport && heightOnly) return;
      setMediaVariant(readMediaVariant());
    };
    updateVariant();
    window.addEventListener("resize", updateVariant, { passive: true });
    window.addEventListener("orientationchange", updateVariant, { passive: true });
    window.addEventListener("pageshow", updateVariant);
    window.visualViewport?.addEventListener("resize", updateVariant, { passive: true });
    return () => {
      window.removeEventListener("resize", updateVariant);
      window.removeEventListener("orientationchange", updateVariant);
      window.removeEventListener("pageshow", updateVariant);
      window.visualViewport?.removeEventListener("resize", updateVariant);
    };
  }, []);

  useEffect(() => {
    const updateVisibility = () => setPageVisible(document.visibilityState !== "hidden");
    document.addEventListener("visibilitychange", updateVisibility);
    return () => document.removeEventListener("visibilitychange", updateVisibility);
  }, []);

  useEffect(() => {
    const updateAutoplayPolicy = () => setAutoplayEligible(getHeroAutoplayPolicy(window));
    const motionQuery = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    const connection = window.navigator?.connection;
    motionQuery?.addEventListener?.("change", updateAutoplayPolicy);
    connection?.addEventListener?.("change", updateAutoplayPolicy);
    return () => {
      motionQuery?.removeEventListener?.("change", updateAutoplayPolicy);
      connection?.removeEventListener?.("change", updateAutoplayPolicy);
    };
  }, []);

  useEffect(() => {
    setVideoFailed(false);
  }, [source]);

  useEffect(() => {
    if (!pageVisible || !canMountVideo || (videoPoster && readyPoster !== videoPoster)) return undefined;
    return scheduleHeroVideoPlayback(() => setActivatedSource(source), window);
  }, [pageVisible, canMountVideo, source, videoPoster, readyPoster]);

  useEffect(() => {
    if (usePoster) return undefined;
    const video = videoRef.current;
    if (!video) return undefined;
    const scene = video.closest("#acasa") || video;
    let disposed = false;
    let lifecycleHidden = false;
    let mediaVisible = true;
    let retryTimer;
    let errorAttempts = 0;
    let playbackWatchdog;
    const lifecycleTimers = new Set();
    let visibilityObserver;

    const clearRetry = () => {
      if (retryTimer) window.clearTimeout(retryTimer);
      retryTimer = undefined;
    };

    const attemptPlayback = (force = false) => {
      if (disposed || lifecycleHidden || !mediaVisible || (!force && document.visibilityState === "hidden")) return;
      const promise = video.play();
      promise?.catch(() => {
        if (disposed || lifecycleHidden || !mediaVisible) return;
        clearRetry();
        retryTimer = window.setTimeout(attemptPlayback, 320);
      });
    };

    const recoverPlayback = (force = false) => {
      if (disposed || lifecycleHidden || !mediaVisible || (!force && document.visibilityState === "hidden")) return;
      if (!video.getAttribute("src")) {
        video.setAttribute("src", source);
        video.load();
      } else if (video.error || video.networkState === HTMLMediaElement.NETWORK_EMPTY
        || video.networkState === HTMLMediaElement.NETWORK_NO_SOURCE) {
        video.load();
      }
      // A slow request is still a valid request. Calling load() for readyState 0
      // repeatedly aborts that request and can leave Safari on its poster forever.
      attemptPlayback(force);
    };

    const pausePlayback = () => {
      clearRetry();
      video.pause();
    };

    const releasePlayback = () => {
      pausePlayback();
      if (video.getAttribute("src")) {
        video.removeAttribute("src");
        video.load();
      }
    };

    const syncSceneVisibility = (force = false) => {
      const rect = scene.getBoundingClientRect();
      mediaVisible = rect.bottom > 0 && rect.top < window.innerHeight
        && rect.right > 0 && rect.left < window.innerWidth;
      if (mediaVisible) recoverPlayback(force);
      // Keep the decoded source attached while the homepage is still mounted.
      // Calling load() at this exact scroll boundary can stall the first gallery
      // frame, especially in mobile Safari. Unmount cleanup still releases it.
      else pausePlayback();
    };

    playbackWatchdog = window.setInterval(() => {
      if (disposed || lifecycleHidden) return;
      // Reconcile against the stable section as well as IntersectionObserver:
      // restored pages can miss a video-element intersection notification.
      syncSceneVisibility();
    }, 1_200);

    const scheduleLifecycleRecovery = () => {
      [120, 650, 1400, 2600, 5000].forEach((delay) => {
        const timer = window.setTimeout(() => {
          lifecycleTimers.delete(timer);
          syncSceneVisibility(true);
        }, delay);
        lifecycleTimers.add(timer);
      });
    };

    const onVisibilityChange = () => {
      lifecycleHidden = document.visibilityState === "hidden";
      if (lifecycleHidden) video.pause();
      else syncSceneVisibility();
    };

    const onPageHide = () => {
      lifecycleHidden = true;
      video.pause();
    };
    const onPageShow = () => {
      lifecycleHidden = false;
      syncSceneVisibility(true);
      scheduleLifecycleRecovery();
    };
    const onFocus = () => {
      if (!lifecycleHidden) syncSceneVisibility(true);
    };
    const onOnline = () => {
      if (!lifecycleHidden) syncSceneVisibility(true);
    };
    const onError = () => {
      if (disposed || !mediaVisible || !video.getAttribute("src")) return;
      if (!mediaOverride && source !== media.src) {
        setDelivery({ original: media.src, src: media.src });
        return;
      }
      if (errorAttempts < 2) {
        errorAttempts += 1;
        clearRetry();
        retryTimer = window.setTimeout(recoverPlayback, 220 * errorAttempts);
        return;
      }
      setVideoFailed(true);
    };
    const onLoadedMetadata = () => attemptPlayback();
    const onLoadedData = () => attemptPlayback();
    const onCanPlay = () => attemptPlayback();
    const onPlaying = () => {
      clearRetry();
    };
    const onStalled = () => recoverPlayback();

    if (typeof IntersectionObserver !== "undefined") {
      visibilityObserver = new IntersectionObserver(() => syncSceneVisibility(), { threshold: [0, 0.01] });
      visibilityObserver.observe(scene);
    }

    video.addEventListener("loadedmetadata", onLoadedMetadata);
    video.addEventListener("loadeddata", onLoadedData);
    video.addEventListener("canplay", onCanPlay);
    video.addEventListener("playing", onPlaying);
    video.addEventListener("stalled", onStalled);
    video.addEventListener("error", onError);
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("pageshow", onPageShow);
    window.addEventListener("focus", onFocus);
    window.addEventListener("online", onOnline);

    syncSceneVisibility();
    scheduleLifecycleRecovery();
    return () => {
      disposed = true;
      visibilityObserver?.disconnect();
      releasePlayback();
      window.clearInterval(playbackWatchdog);
      clearRetry();
      lifecycleTimers.forEach((timer) => window.clearTimeout(timer));
      lifecycleTimers.clear();
      video.removeEventListener("loadedmetadata", onLoadedMetadata);
      video.removeEventListener("loadeddata", onLoadedData);
      video.removeEventListener("canplay", onCanPlay);
      video.removeEventListener("playing", onPlaying);
      video.removeEventListener("stalled", onStalled);
      video.removeEventListener("error", onError);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("pageshow", onPageShow);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("online", onOnline);
    };
  }, [source, usePoster, media.src, mediaOverride]);

  return (
    <div className="hero-video-stage absolute inset-0 z-0 overflow-hidden">
      {customVideoStill ? (
        <video
          key={`still-${source}`}
          src={source}
          muted
          playsInline
          preload="metadata"
          className="hero-media-surface hero-media-video absolute inset-0 h-full w-full object-cover"
          style={{ objectPosition, objectFit: "cover" }}
          data-crop-profile={mediaVariant}
          aria-label="Cadru video FireArtRo"
        />
      ) : usePoster || (mediaOverride && mediaOverride.type !== "video") ? (
        <img
          src={fallbackImage}
          onLoad={() => setReadyPoster(fallbackImage)}
          onError={() => setReadyPoster(fallbackImage)}
          alt={mediaOverride?.alt || HERO_MEDIA.label}
          width={media.width}
          height={media.height}
          className="hero-media-surface hero-media-webp absolute inset-0 h-full w-full object-cover"
          style={{ objectPosition, objectFit: "cover" }}
          data-crop-profile={mediaVariant}
          fetchPriority="high"
          decoding="async"
          loading="eager"
        />
      ) : (
        <video
          key={source}
          ref={videoRef}
          src={source}
          poster={videoPoster}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          className="hero-media-surface hero-media-video absolute inset-0 h-full w-full object-cover"
          style={{ objectPosition, objectFit: "cover" }}
          data-media-variant={mediaVariant}
          data-crop-profile={mediaVariant}
          aria-label={mediaOverride?.alt || HERO_MEDIA.label}
        />
      )}

      <div className="hero-video-overlay hero-video-overlay--base" />
      <div className="hero-video-overlay hero-video-overlay--glow" />
      <div className="hero-video-overlay hero-video-overlay--vertical" />
      <div className="hero-video-overlay hero-video-overlay--horizontal" />
      <div className="hero-video-overlay hero-video-overlay--vignette" />
      <HeroKineticTitles videoRef={videoRef} enabled={!mediaOverride && !usePoster && pageVisible} source={source} />
    </div>
  );
};

export default HeroVideo;
