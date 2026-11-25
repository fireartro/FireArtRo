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
      const carousel = element.closest('.es-carousel-layout');
      const previous = enhancedCarousels.get(carousel);
      if (previous?.swiper === swiper) continue;
      if (previous) carousel.removeEventListener('wheel', previous.onWheel, true);
      swiper.setGrabCursor?.();

      let settleTimer;
      function onWheel(event) {
        if (element.swiper !== swiper || swiper.destroyed || swiper.isLocked
          || swiper.touchEventsData?.isTouched || event.ctrlKey
          || Math.abs(event.deltaX) <= Math.abs(event.deltaY)) return;

        const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? element.clientWidth : 1;
        const direction = swiper.rtlTranslate ? -1 : 1;
        const position = swiper.animating ? swiper.getTranslate() : swiper.translate * direction;
        const next = Math.max(swiper.maxTranslate(), Math.min(swiper.minTranslate(),
          position - event.deltaX * unit * direction));
        if (next === position) return;
        if (event.cancelable) event.preventDefault();

        if (swiper.animating) {
          // Finish Swiper's pending transition before taking control of its position.
          swiper.setTransition(0);
          swiper.wrapperEl.dispatchEvent(new Event('transitionend'));
        }
        swiper.setTranslate(next);
        swiper.updateActiveIndex();
        swiper.updateSlidesClasses();

        // Trackpads already send momentum deltas. Align when those events stop.
        clearTimeout(settleTimer);
        settleTimer = setTimeout(() => {
          if (element.swiper === swiper && !swiper.destroyed && !swiper.animating
            && !swiper.touchEventsData?.isTouched) {
            swiper.slideToClosest(motion.matches ? 0 : 180);
          }
        }, 150);
      }
      enhancedCarousels.set(carousel, { swiper, onWheel });
      carousel.addEventListener('wheel', onWheel, { capture: true, passive: false });
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
