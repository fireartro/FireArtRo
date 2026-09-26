import { useCallback, useEffect, useRef, useState } from 'react';
import HeroKineticTitles from './HeroKineticTitles';
import montageTitles from '@/data/heroMontageTitles.json';
import { canPlayHeroVideo, getHeroAutoplayPolicy, scheduleHeroVideoPlayback } from './heroPlayback';
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
  const mounted = useRef(true);
  const playbackAllowed = useRef(true);
  const [posterReady, setPosterReady] = useState(false);
  const [activated, setActivated] = useState(false);
  const [slotIndices, setSlotIndices] = useState([0, null]);
  const [activeSlot, setActiveSlot] = useState(0);
  const [playingSlot, setPlayingSlot] = useState(null);
  const [pageVisible, setPageVisible] = useState(() => typeof document === 'undefined' || document.visibilityState !== 'hidden');
  const [inView, setInView] = useState(true);
  const [autoplayEligible, setAutoplayEligible] = useState(() => typeof window === 'undefined' || getHeroAutoplayPolicy(window));
  const [videoSupported] = useState(() => typeof document === 'undefined' || canPlayHeroVideo(document.createElement('video')));
  const [failed, setFailed] = useState(false);
  const visible = pageVisible && inView;
  const enabled = autoplayEligible && videoSupported && !failed;
  playbackAllowed.current = visible && enabled;
  const currentFilmIndex = slotIndices[activeSlot];
  const currentSource = films[format][currentFilmIndex];

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    const update = () => setPageVisible(document.visibilityState !== 'hidden');
    document.addEventListener('visibilitychange', update);
    window.addEventListener('pageshow', update);
    return () => {
      document.removeEventListener('visibilitychange', update);
      window.removeEventListener('pageshow', update);
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
    if (visible && enabled) video.play().catch(() => { /* poster remains if autoplay is denied */ });
    else video.pause();
    return undefined;
  }, [activated, activeSlot, visible, enabled]);

  const trySwitch = useCallback(() => {
    if (!pendingSwitch.current || starting.current || !playbackAllowed.current) return;
    const nextSlot = 1 - activeSlot;
    const nextVideo = videoRefs.current[nextSlot];
    if (!nextVideo || nextVideo.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
    starting.current = true;
    nextVideo.currentTime = 0;
    nextVideo.play().then(() => {
      if (!mounted.current || !playbackAllowed.current) {
        nextVideo.pause();
        starting.current = false;
        return;
      }
      const oldVideo = videoRefs.current[activeSlot];
      oldVideo?.pause();
      pendingSwitch.current = false;
      starting.current = false;
      setActiveSlot(nextSlot);
      setPlayingSlot(nextSlot);
      setSlotIndices(previous => previous.map((index, slot) => slot === activeSlot ? null : index));
    }).catch(() => {
      starting.current = false;
      if (mounted.current) setFailed(true);
    });
  }, [activeSlot]);

  useEffect(() => { if (visible && enabled) trySwitch(); }, [visible, enabled, trySwitch]);

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

  const onNextReady = useCallback(() => {
    if (pendingSwitch.current) trySwitch();
  }, [trySwitch]);

  return (
    <div ref={stageRef} className="hero-video-stage hero-montage absolute inset-0 z-0 overflow-hidden">
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
            autoPlay={slot === activeSlot && visible}
            muted
            playsInline
            preload={slot === activeSlot ? 'metadata' : 'auto'}
            onLoadedData={slot === activeSlot ? event => {
              if (playbackAllowed.current) event.currentTarget.play().catch(() => {});
            } : onNextReady}
            onCanPlay={slot === activeSlot ? undefined : onNextReady}
            onPlaying={() => { if (slot === activeSlot) setPlayingSlot(slot); }}
            onTimeUpdate={slot === activeSlot ? onTimeUpdate : undefined}
            onEnded={slot === activeSlot ? onEnded : undefined}
            onError={() => setFailed(true)}
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
