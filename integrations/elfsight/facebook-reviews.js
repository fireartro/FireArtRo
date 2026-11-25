// Elfsight Settings > Custom JS. Only widget readiness and popup state cross the iframe boundary.
(() => {
  const site = 'https://fireart.ro';
  if (window.parent === window) return;

  const widgetSelector = '.elfsight-app-5cd3630c-2af7-47e7-8e24-cbbda99bf22a';
  const observedRoots = new WeakSet();
  const enhancedCarousels = new WeakMap();
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const observer = new MutationObserver(scheduleSync);
  let popup = null;
  let trigger = null;
  let scheduled = false;
  let announcedReady = false;

  function observeRoot(root) {
    if (observedRoots.has(root)) return;
    observedRoots.add(root);
    observer.observe(root, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['aria-hidden'] });
  }

  function enhanceCarousel(root) {
    for (const element of root.querySelectorAll('.es-carousel-layout .swiper-initialized')) {
      const swiper = element.swiper;
      if (!swiper || swiper.destroyed) continue;
      swiper.params.speed = motion.matches ? 0 : 330;
      swiper.params.threshold = 9;
      swiper.params.longSwipesRatio = 0.32;
      swiper.params.grabCursor = true;
      if (enhancedCarousels.get(element) === swiper) continue;
      enhancedCarousels.set(element, swiper);
      swiper.setGrabCursor?.();

      let lastWheel = 0;
      let distance = 0;
      let advanced = false;
      element.addEventListener('wheel', event => {
        if (element.swiper !== swiper || swiper.destroyed || event.ctrlKey
          || Math.abs(event.deltaX) <= Math.abs(event.deltaY) * 1.2) return;
        const now = performance.now();
        if (now - lastWheel > 170) { distance = 0; advanced = false; }
        lastWheel = now;
        const forward = event.deltaX > 0;
        if (swiper.isLocked || (!swiper.params.loop && (forward ? swiper.isEnd : swiper.isBeginning))) return;
        event.preventDefault();
        if (advanced || swiper.animating) return;
        distance += event.deltaX * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? element.clientWidth : 1);
        if (Math.abs(distance) < 40) return;
        advanced = true;
        const speed = motion.matches ? 0 : 330;
        if (distance > 0) swiper.slideNext(speed);
        else swiper.slidePrev(speed);
      }, { passive: false });
    }
  }

  function hasReviewContent(root) {
    enhanceCarousel(root);
    for (const card of root.querySelectorAll('.es-review-container')) {
      const content = card.querySelectorAll('.es-text-shortener, .es-review-author-name');
      if (Array.from(content).some(part => part.textContent.trim())) return true;
    }
    for (const host of root.querySelectorAll('*')) {
      const shadow = host.shadowRoot;
      if (!shadow) continue;
      observeRoot(shadow);
      if (hasReviewContent(shadow)) return true;
    }
    return false;
  }

  function signalReady(reply = false) {
    const widget = document.querySelector(widgetSelector);
    if (!hasReviewContent(widget || document.body) || (!reply && announcedReady)) return;
    announcedReady = true;
    window.parent.postMessage({ type: 'fireart:review-ready' }, site);
  }

  function sync() {
    scheduled = false;
    signalReady();
    let next = null;
    for (const host of document.querySelectorAll('.es-portal-root > div')) {
      const root = host.shadowRoot;
      if (!root) continue;
      observeRoot(root);
      next = root.querySelector('.es-popup-wrapper[role="dialog"][aria-hidden="false"]');
      if (next) break;
    }
    if (Boolean(next) !== Boolean(popup)) {
      window.parent.postMessage({ type: 'fireart:review-dialog', open: Boolean(next) }, site);
      if (!next && trigger?.isConnected) trigger.focus({ preventScroll: true });
    }
    popup = next;
  }

  function scheduleSync() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(sync);
  }

  observeRoot(document.body);
  motion.addEventListener('change', scheduleSync);
  document.addEventListener('click', event => {
    const control = event.composedPath().find(node => node.matches?.('.es-text-shortener-control-open[aria-haspopup="dialog"]'));
    if (control && !popup) trigger = control;
    scheduleSync();
  }, true);
  window.addEventListener('message', event => {
    if (event.origin !== site || event.source !== window.parent) return;
    if (event.data?.type === 'fireart:close-review-dialog') {
      popup?.querySelector('.es-popup-close-button')?.click();
    } else if (event.data?.type === 'fireart:check-review-ready') {
      signalReady(true);
    }
  });
  sync();
})();
