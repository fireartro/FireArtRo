import { useCallback, useEffect, useRef, useState } from 'react';
import HeroKineticTitles from './HeroKineticTitles';
import montageTitles from '@/data/heroMontageTitles.json';
import { canPlayHeroVideo, canStartHeroVideo, getHeroAutoplayPolicy, isHeroIntroLoading, primeHeroVideoBuffer, scheduleHeroVideoPlayback } from './heroPlayback';
import { getNextFilmIndex, selectMontageFormat, shouldPreloadNextFilm } from './heroMontagePlayback';

const mediaVersion = '20260926-r6';
const films = {
  wide: [1, 2, 3].map(index => `/media/hero-film-wide-${index}.mp4?v=${mediaVersion}`),
  portrait: [1, 2, 3].map(index => `/media/hero-film-portrait-${index}.mp4?v=${mediaVersion}`),
};
const posters = {
  wide: `/media/hero-film-wide.webp?v=${mediaVersion}`,
  portrait: `/media/hero-film-portrait.webp?v=${mediaVersion}`,
};
const readFormat = () => typeof window === 'undefined'
  ? 'wide'
  : selectMontageFormat(window.innerWidth, window.innerHeight);

function HeroMontagePlayer({ format }) {
  const stageRef = useRef(null);
  const videoRefs = useRef([null, null]);
  const activeVideoRef = useRef(null);
  const pendingSwitch = useRef(false);
  const starting = useRef(false);
  const switchWatchdog = useRef(null);
  const switchAttempt = useRef(0);
  const switchRef = useRef(null);
  const activeSlotRef = useRef(0);
  const retryTimers = useRef([null, null]);
  const retryAttempts = useRef([0, 0]);
  const resumeAt = useRef([null, null]);
  const mounted = useRef(true);
  const playbackAllowed = useRef(true);
  const lifecycleHidden = useRef(false);
  const recoverRef = useRef(null);
  const [posterReady, setPosterReady] = useState(false);
  const [activated, setActivated] = useState(false);
  const [slotIndices, setSlotIndices] = useState([0, null]);
  const [activeSlot, setActiveSlot] = useState(0);
  const [playingSlot, setPlayingSlot] = useState(null);
  const [pageVisible, setPageVisible] = useState(() => typeof document === 'undefined' || document.visibilityState !== 'hidden');
  const [inView, setInView] = useState(true);
  const [autoplayEligible, setAutoplayEligible] = useState(() => typeof window === 'undefined' || getHeroAutoplayPolicy(window));
  const [videoSupported] = useState(() => typeof document === 'undefined' || canPlayHeroVideo(document.createElement('video')));
  const visible = pageVisible && inView;
  const enabled = autoplayEligible && videoSupported;
  activeSlotRef.current = activeSlot;
  playbackAllowed.current = visible && enabled && !lifecycleHidden.current;
  const currentFilmIndex = slotIndices[activeSlot];
  const currentSource = films[format][currentFilmIndex];

  useEffect(() => {
    mounted.current = true;
    const timers = retryTimers.current;
    return () => {
      mounted.current = false;
      switchAttempt.current += 1;
      window.clearTimeout(switchWatchdog.current);
      timers.forEach(timer => window.clearTimeout(timer));
    };
  }, []);

  useEffect(() => {
    const suspend = () => {
      lifecycleHidden.current = true;
      playbackAllowed.current = false;
      setPageVisible(false);
      switchAttempt.current += 1;
      starting.current = false;
      window.clearTimeout(switchWatchdog.current);
      videoRefs.current.forEach(video => video?.pause());
    };
    const update = () => {
      if (document.visibilityState === 'hidden') suspend();
      else {
        lifecycleHidden.current = false;
        setPageVisible(true);
        recoverRef.current?.();
      }
    };
    const recover = () => {
      if (!lifecycleHidden.current && document.visibilityState !== 'hidden') recoverRef.current?.();
    };
    document.addEventListener('visibilitychange', update);
    window.addEventListener('pageshow', update);
    window.addEventListener('pagehide', suspend);
    window.addEventListener('focus', recover);
    window.addEventListener('online', recover);
    return () => {
      document.removeEventListener('visibilitychange', update);
      window.removeEventListener('pageshow', update);
      window.removeEventListener('pagehide', suspend);
      window.removeEventListener('focus', recover);
      window.removeEventListener('online', recover);
    };
  }, []);

  useEffect(() => {
    const update = () => setAutoplayEligible(getHeroAutoplayPolicy(window));
    const motion = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const connection = window.navigator?.connection;
    motion?.addEventListener?.('change', update);
    connection?.addEventListener?.('change', update);
    return () => {
      motion?.removeEventListener?.('change', update);
      connection?.removeEventListener?.('change', update);
    };
  }, []);

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return undefined;
    const observer = new IntersectionObserver(entries => setInView(entries[0]?.isIntersecting ?? true), { threshold: 0.01 });
    const hero = stageRef.current?.closest('#acasa') || stageRef.current;
    if (hero) observer.observe(hero);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!posterReady || !visible || !enabled || activated) return undefined;
    return scheduleHeroVideoPlayback(() => setActivated(true), window);
  }, [posterReady, visible, enabled, activated]);

  useEffect(() => {
    if (!activated) return undefined;
    const video = videoRefs.current[activeSlot];
    activeVideoRef.current = video;
    if (!video) return undefined;
    const startPlayback = () => {
      if (!playbackAllowed.current) return;
      if (canStartHeroVideo(video, window)) {
        video.play().catch(() => { /* the intro offers manual entry if autoplay is denied */ });
      } else primeHeroVideoBuffer(video, window);
    };
    if (visible && enabled) startPlayback();
    else video.pause();
    window.addEventListener('fireart:intro-dismissed', startPlayback);
    return () => window.removeEventListener('fireart:intro-dismissed', startPlayback);
  }, [activated, activeSlot, visible, enabled]);

  const retryVideo = useCallback((slot, reload = true) => {
    const video = videoRefs.current[slot];
    if (!video || retryTimers.current[slot] !== null) return;
    // Recover only the failed element; do not tear down the healthy current
    // film or replay a scene from the beginning after an active media error.
    if (reload && resumeAt.current[slot] === null) {
      resumeAt.current[slot] = video === activeVideoRef.current ? video.currentTime : 0;
    }
    const delay = Math.min(1000 * 2 ** Math.min(retryAttempts.current[slot]++, 3), 8000);
    retryTimers.current[slot] = window.setTimeout(() => {
      retryTimers.current[slot] = null;
      if (!mounted.current || !playbackAllowed.current || videoRefs.current[slot] !== video) return;
      if (slot !== activeSlotRef.current) starting.current = false;
      if (reload) video.load();
      if (pendingSwitch.current) switchRef.current?.();
    }, delay);
  }, []);

  const clearRetry = useCallback(slot => {
    window.clearTimeout(retryTimers.current[slot]);
    retryTimers.current[slot] = null;
    retryAttempts.current[slot] = 0;
  }, []);

  const trySwitch = useCallback(() => {
    if (!pendingSwitch.current || starting.current || !playbackAllowed.current) return;
    const nextSlot = 1 - activeSlot;
    const nextVideo = videoRefs.current[nextSlot];
    if (!nextVideo) return;
    if (nextVideo.error) { retryVideo(nextSlot); return; }
    starting.current = true;
    const attempt = ++switchAttempt.current;
    const finishAttempt = () => {
      if (attempt !== switchAttempt.current) return false;
      window.clearTimeout(switchWatchdog.current);
      switchWatchdog.current = null;
      starting.current = false;
      return true;
    };
    // Reconcile a pending play() without aborting a healthy slow download.
    // A new play request can recover a suspended browser, but load()/pause()
    // here would discard progress every five seconds on a weak connection.
    switchWatchdog.current = window.setTimeout(() => {
      if (!finishAttempt() || !mounted.current) return;
      switchAttempt.current += 1;
      if (!playbackAllowed.current) return;
      const failed = Boolean(nextVideo.error) || nextVideo.networkState === HTMLMediaElement.NETWORK_NO_SOURCE;
      if (failed) retryVideo(nextSlot);
      else switchRef.current?.();
    }, 5000);
    // preload="auto" is advisory. Some browsers keep only metadata until
    // play() explicitly asks for data; waiting for loadeddata can deadlock.
    if (nextVideo.readyState >= HTMLMediaElement.HAVE_METADATA) nextVideo.currentTime = 0;
    Promise.resolve(nextVideo.play()).then(() => {
      if (!finishAttempt()) return;
      if (!mounted.current || !playbackAllowed.current) {
        nextVideo.pause();
        return;
      }
      const oldVideo = videoRefs.current[activeSlot];
      oldVideo?.pause();
      clearRetry(activeSlot);
      clearRetry(nextSlot);
      resumeAt.current[activeSlot] = null;
      resumeAt.current[nextSlot] = null;
      pendingSwitch.current = false;
      setActiveSlot(nextSlot);
      setPlayingSlot(nextSlot);
      setSlotIndices(previous => previous.map((index, slot) => slot === activeSlot ? null : index));
    }).catch(() => {
      if (!finishAttempt()) return;
      if (mounted.current && playbackAllowed.current) retryVideo(nextSlot, false);
    });
  }, [activeSlot, clearRetry, retryVideo]);
  switchRef.current = trySwitch;

  recoverRef.current = () => {
    if (!mounted.current || lifecycleHidden.current || document.visibilityState === 'hidden' || !inView || !enabled) return;
    playbackAllowed.current = true;
    if (pendingSwitch.current) {
      trySwitch();
      return;
    }
    const video = videoRefs.current[activeSlotRef.current];
    if (!video) return;
    if (video.error || video.networkState === HTMLMediaElement.NETWORK_NO_SOURCE) {
      retryVideo(activeSlotRef.current);
    } else if (canStartHeroVideo(video, window)) {
      video.play().catch(() => {});
    } else primeHeroVideoBuffer(video, window);
  };

  useEffect(() => {
    if (!visible || !enabled) return;
    videoRefs.current.forEach((video, slot) => { if (video?.error) retryVideo(slot); });
    trySwitch();
  }, [visible, enabled, slotIndices, retryVideo, trySwitch]);

  const requestNext = useCallback(() => {
    setSlotIndices(previous => {
      if (previous[1 - activeSlot] !== null) return previous;
      const next = [...previous];
      next[1 - activeSlot] = getNextFilmIndex(previous[activeSlot], films[format].length);
      return next;
    });
  }, [activeSlot, format]);

  const onTimeUpdate = useCallback(event => {
    if (!visible || !activated) return;
    const video = event.currentTarget;
    if (shouldPreloadNextFilm(video.currentTime, video.duration || 30, true)) requestNext();
  }, [activated, requestNext, visible]);

  const onEnded = useCallback(() => {
    requestNext();
    pendingSwitch.current = true;
    trySwitch();
  }, [requestNext, trySwitch]);

  const onNextReady = useCallback(slot => {
    clearRetry(slot);
    if (pendingSwitch.current) trySwitch();
  }, [clearRetry, trySwitch]);

  const onMetadata = useCallback((slot, video) => {
    const saved = resumeAt.current[slot];
    if (saved !== null) {
      if (saved > 0) video.currentTime = Number.isFinite(video.duration)
        ? Math.min(saved, Math.max(0, video.duration - 0.05)) : saved;
      resumeAt.current[slot] = null;
    }
    if (slot !== activeSlotRef.current && pendingSwitch.current) trySwitch();
  }, [trySwitch]);

  return (
    <div ref={stageRef} data-hero-playback={enabled ? 'video' : 'poster'} className="hero-video-stage hero-montage absolute inset-0 z-0 overflow-hidden">
      <img
        src={posters[format]}
        onLoad={() => setPosterReady(true)}
        onError={() => setPosterReady(true)}
        alt="Spectacol real de artificii FireArtRo"
        width={format === 'wide' ? 1920 : 1080}
        height={format === 'wide' ? 1080 : 1920}
        className="hero-media-surface hero-media-webp hero-montage__poster absolute inset-0 h-full w-full object-cover"
        fetchPriority="high"
        decoding="async"
        loading="eager"
      />
      {activated && enabled && [0, 1].map(slot => {
        const index = slotIndices[slot];
        if (index === null) return null;
        return (
          <video
            key={`${format}-${slot}-${index}`}
            ref={element => { videoRefs.current[slot] = element; if (slot === activeSlot) activeVideoRef.current = element; }}
            src={films[format][index]}
            autoPlay={slot === activeSlot && visible && !isHeroIntroLoading(window)}
            muted
            playsInline
            preload="auto"
            onLoadedMetadata={event => onMetadata(slot, event.currentTarget)}
            onLoadedData={slot === activeSlot ? event => {
              clearRetry(slot);
              const video = event.currentTarget;
              if (!canStartHeroVideo(video, window)) video.pause();
              else if (playbackAllowed.current) video.play().catch(() => {});
            } : () => onNextReady(slot)}
            onCanPlay={() => onNextReady(slot)}
            onCanPlayThrough={event => {
              if (slot === activeSlot && playbackAllowed.current && canStartHeroVideo(event.currentTarget, window)) {
                event.currentTarget.play().catch(() => {});
              } else onNextReady(slot);
            }}
            onSuspend={event => {
              if (slot === activeSlot && playbackAllowed.current) primeHeroVideoBuffer(event.currentTarget, window);
            }}
            onPlaying={event => {
              if (!playbackAllowed.current || !canStartHeroVideo(event.currentTarget, window)) event.currentTarget.pause();
              else if (slot === activeSlot) setPlayingSlot(slot);
            }}
            onTimeUpdate={slot === activeSlot ? onTimeUpdate : undefined}
            onEnded={slot === activeSlot ? onEnded : undefined}
            onError={() => retryVideo(slot)}
            data-media-variant={format}
            data-film-index={index}
            className={`hero-media-surface hero-media-video hero-montage__video absolute inset-0 h-full w-full object-cover${slot === activeSlot && playingSlot === slot ? ' hero-montage__video--visible' : ''}`}
          />
        );
      })}
      <div className="hero-video-overlay hero-video-overlay--base" />
      <div className="hero-video-overlay hero-video-overlay--glow" />
      <div className="hero-video-overlay hero-video-overlay--vertical" />
      <div className="hero-video-overlay hero-video-overlay--horizontal" />
      <div className="hero-video-overlay hero-video-overlay--vignette" />
      <HeroKineticTitles videoRef={activeVideoRef} enabled={activated && enabled && visible && playingSlot === activeSlot} source={currentSource} filmConfig={montageTitles[currentFilmIndex]} />
    </div>
  );
}

export default function HeroMontage() {
  const [format, setFormat] = useState(readFormat);
  useEffect(() => {
    let lastWidth = window.innerWidth;
    const update = () => {
      const width = window.innerWidth;
      // Address-bar and keyboard height changes should not restart a phone film.
      if (width === lastWidth && width <= 900) return;
      lastWidth = width;
      setFormat(readFormat());
    };
    window.addEventListener('resize', update, { passive: true });
    const rotate = () => setFormat(readFormat());
    window.addEventListener('orientationchange', rotate, { passive: true });
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', rotate);
    };
  }, []);
  return <HeroMontagePlayer key={format} format={format} />;
}
