// A running media clock can survive a lost hardware decoder. Observe presented
// frames when available; do not reload a legitimate network buffer or hidden tab.
export function watchHeroFrames(video, recover, allowed) {
  let lastFrame = performance.now();
  let lastTime = video.currentTime;
  let callback;
  let stopped = false;
  const presented = () => {
    lastFrame = performance.now();
    if (!stopped) callback = video.requestVideoFrameCallback(presented);
  };
  if (video.requestVideoFrameCallback) callback = video.requestVideoFrameCallback(presented);
  const timer = setInterval(() => {
    const now = performance.now();
    const buffering = video.readyState < 2 && video.networkState !== 1 && video.networkState !== 0;
    if (!allowed() || video.ended || buffering || video.seeking) {
      lastFrame = now;
      lastTime = video.currentTime;
      return;
    }
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
