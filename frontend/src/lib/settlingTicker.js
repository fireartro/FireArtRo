// Keep eased scroll motion frame-driven only while it is catching up. Removing
// our listener lets GSAP sleep when the page has no other active animation.
export function createSettlingTicker(ticker, { readCurrent, readTarget, advance }) {
  let active = false;
  const stop = () => {
    if (!active) return;
    active = false;
    ticker.remove(tick);
  };
  const tick = () => {
    const target = readTarget();
    if (target === undefined) {
      stop();
      return;
    }
    if (readCurrent() !== target) advance(target);
    if (readCurrent() === target) stop();
  };
  const wake = () => {
    const target = readTarget();
    if (active || target === undefined || readCurrent() === target) return;
    active = true;
    ticker.add(tick);
  };
  return { wake, stop };
}
