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
  effectiveType = '',
} = {}) {
  const lowBandwidthConnection = ['slow-2g', '2g', '3g'].includes(effectiveType);
  return !(reducedMotion || saveData || lowBandwidthConnection);
}

export function getHeroAutoplayPolicy(windowLike) {
  const connection = windowLike?.navigator?.connection;
  return shouldAutoplayHeroVideo({
    reducedMotion: windowLike?.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
    saveData: connection?.saveData,
    effectiveType: connection?.effectiveType,
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
