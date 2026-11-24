// Elfsight Settings > Custom JS. Only widget readiness and popup state cross the iframe boundary.
(() => {
  const site = 'https://fireart.ro';
  if (window.parent === window) return;

  const widgetSelector = '.elfsight-app-5cd3630c-2af7-47e7-8e24-cbbda99bf22a';
  const observedRoots = new WeakSet();
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

  function hasReviewContent(root) {
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
    if (!reply && announcedReady) return;
    const widget = document.querySelector(widgetSelector);
    if (!hasReviewContent(widget || document.body)) return;
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
