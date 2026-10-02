// The bundled variants are H264 High Profile, up to Level 4.0. Unsupported
// browsers should show the existing poster, not download the movie first.
export function canPlayHeroVideo(video) {
  return Boolean(video.canPlayType('video/mp4; codecs="avc1.640028"'));
}

// A smaller codec is not an optimization if it forces expensive software
// decoding. Query before attaching a source; never download both formats.
export async function selectHeroSource(media, navigatorLike) {
  const capabilities = navigatorLike?.mediaCapabilities;
  if (!media.av1Src || typeof capabilities?.decodingInfo !== 'function') return media.src;
  let timer;
  try {
    const result = await Promise.race([
      capabilities.decodingInfo({ type: 'file', video: {
        contentType: 'video/mp4; codecs="av01.0.08M.08"',
        width: media.width, height: media.height, bitrate: 9_000_000, framerate: 24,
      } }),
      new Promise(resolve => { timer = setTimeout(() => resolve(null), 200); }),
    ]);
    return result?.supported && result.smooth && result.powerEfficient ? media.av1Src : media.src;
  } catch { return media.src; }
  finally { clearTimeout(timer); }
}

export const HERO_VIDEO_IDLE_TIMEOUT_MS = 1_200;

export function shouldAutoplayHeroVideo({
  reducedMotion = false,
  saveData = false,
} = {}) {
  // Connection speed controls how long the intro buffers, not whether the
  // film exists. Only explicit accessibility/data-saving choices disable it.
  return !(reducedMotion || saveData);
}

export function isHeroIntroLoading(windowLike) {
  return windowLike?.document?.documentElement?.dataset.fireartIntro === 'loading';
}

export function canStartHeroVideo(video, windowLike) {
  // Do not consume the small initial buffer behind the loading overlay.
  // HAVE_ENOUGH_DATA means the browser expects playback through to the end.
  return !isHeroIntroLoading(windowLike) || video.readyState >= 4;
}

const primingVideos = new WeakSet();

export function primeHeroVideoBuffer(video, windowLike) {
  // preload is only a hint (notably on mobile). A suspended metadata-only
  // request needs play() to ask for data, but must not spend its tiny buffer
  // behind the intro. Never load()/detach the source to recover this case.
  if (!isHeroIntroLoading(windowLike) || video.readyState >= 4 || video.error
    || video.networkState !== 1 || primingVideos.has(video)) return;
  primingVideos.add(video);
  Promise.resolve(video.play()).then(() => {
    if (!canStartHeroVideo(video, windowLike)) video.pause();
  }).catch(() => { /* loadeddata may deliberately pause this warm-up */ })
    .finally(() => primingVideos.delete(video));
}

export function getHeroAutoplayPolicy(windowLike) {
  const connection = windowLike?.navigator?.connection;
  return shouldAutoplayHeroVideo({
    reducedMotion: windowLike?.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
    saveData: connection?.saveData,
  });
}

export function scheduleHeroVideoPlayback(callback, windowLike) {
  let frameId;
  let cancelIdle;
  const scheduleIdle = () => {
    if (typeof windowLike.requestIdleCallback === 'function') {
      const idleId = windowLike.requestIdleCallback(callback, { timeout: HERO_VIDEO_IDLE_TIMEOUT_MS });
      cancelIdle = () => windowLike.cancelIdleCallback?.(idleId);
    } else {
      const timerId = windowLike.setTimeout(callback, HERO_VIDEO_IDLE_TIMEOUT_MS);
      cancelIdle = () => windowLike.clearTimeout(timerId);
    }
  };
  // Called only after the poster loads. Leave a painted frame before the video
  // competes for decoding/network resources, including when idle fires early.
  frameId = windowLike.requestAnimationFrame(() => {
    frameId = windowLike.requestAnimationFrame(scheduleIdle);
  });
  return () => {
    windowLike.cancelAnimationFrame(frameId);
    cancelIdle?.();
  };
}
