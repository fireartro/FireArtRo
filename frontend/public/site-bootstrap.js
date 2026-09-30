// Blocking, same-origin startup: compatible with a CSP that rejects inline JS.
(() => {
  if (/^\/admin\/?$/.test(location.pathname)) return;
  document.documentElement.dataset.fireartIntro = 'loading';
  window.__fireartIntroStarted = performance.now();
  window.__fireartIntroScrollGuard = event => {
    if (event.type === 'keydown' && event.key === ' ' && event.target?.closest?.('#fireart-intro button')) return;
    if (event.type === 'keydown' && !['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(event.key)) return;
    if (event.cancelable) event.preventDefault();
  };
  ['wheel', 'touchmove', 'keydown'].forEach(type => document.addEventListener(type, window.__fireartIntroScrollGuard, { capture: true, passive: false }));
  // Do not confuse a slow script download with a failed script.
  // The existing startup controller clears this guard when it initializes.
  window.__fireartIntroSafety = setInterval(() => {
    if (document.readyState !== 'complete') return;
    clearInterval(window.__fireartIntroSafety);
    delete document.documentElement.dataset.fireartIntro;
    document.getElementById('fireart-intro')?.remove();
    document.getElementById('root')?.removeAttribute('inert');
    ['wheel', 'touchmove', 'keydown'].forEach(type => document.removeEventListener(type, window.__fireartIntroScrollGuard, true));
    delete window.__fireartIntroScrollGuard;
    window.dispatchEvent(new Event('fireart:intro-dismissed'));
  }, 1000);
})();

(() => {
  if (/^\/admin\/?$/.test(location.pathname)) return;
  // Only the published, anonymous snapshot; the provider still validates it.
  window.__fireartContentBoot = {
    startedAt: Date.now(),
    request: fetch('/api/content', { credentials: 'omit', cache: 'no-cache' })
      .then(response => response.ok ? response.json() : null)
      .catch(() => null)
  };
})();

(() => {
  const ua = navigator.userAgent || '';
  const isiOS = /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isSafari = /Safari/.test(ua) && !/Chrome|Chromium|Edg|OPR|SamsungBrowser/.test(ua);
  const isMac = /Macintosh|MacIntel|MacPPC|Mac68K/.test(navigator.platform || ua);
  if (isiOS || isMac) document.documentElement.dataset.applePlatform = 'true';
  if (isiOS || isSafari) document.documentElement.dataset.appleWebkit = 'true';
})();
