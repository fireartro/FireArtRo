// A running media clock can survive a lost hardware decoder. Observe presented
// frames when available; do not reload a legitimate network buffer or hidden tab.
export function watchHeroFrames(video, recover, allowed, onLongBuffer) {
  let lastFrame = performance.now();
  let lastTime = video.currentTime;
  let callback;
  let stopped = false;
  let bufferSince = null;
  let bufferNotified = false;
  const presented = () => {
    lastFrame = performance.now();
    if (!stopped) callback = video.requestVideoFrameCallback(presented);
  };
  if (video.requestVideoFrameCallback) callback = video.requestVideoFrameCallback(presented);
  const timer = setInterval(() => {
    const now = performance.now();
    // HAVE_CURRENT_DATA (2) can display a frame but cannot keep advancing.
    // Reloading that element discards the bytes it was still downloading.
    const buffering = video.readyState < 3 && video.networkState !== 1 && video.networkState !== 0;
    if (!allowed() || video.ended || video.seeking) {
      lastFrame = now;
      lastTime = video.currentTime;
      bufferSince = null;
      bufferNotified = false;
      return;
    }
    if (buffering) {
      lastFrame = now;
      lastTime = video.currentTime;
      if (bufferSince === null) bufferSince = now;
      if (!bufferNotified && now - bufferSince >= 8000) {
        bufferNotified = true;
        onLongBuffer?.();
      }
      return;
    }
    bufferSince = null;
    bufferNotified = false;
    if (!video.requestVideoFrameCallback && video.currentTime !== lastTime) lastFrame = now;
    lastTime = video.currentTime;
    if (now - lastFrame >= 3500) {
      stop();
      recover();
    }
  }, 500);
  function stop() {
    stopped = true;
    clearInterval(timer);
    if (callback !== undefined) video.cancelVideoFrameCallback?.(callback);
  }
  return stop;
}
