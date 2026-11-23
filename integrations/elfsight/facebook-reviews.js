// Elfsight Settings > Custom JS. Only the popup state crosses the iframe boundary.
(() => {
  const site = 'https://fireart.ro';
  if (window.parent === window) return;

  const observedRoots = new WeakSet();
  let observer;
  let popup = null;
  let trigger = null;
  let scheduled = false;

  function syncPopup() {
    scheduled = false;
    let next = null;
    for (const host of document.querySelectorAll('.es-portal-root > div')) {
      const root = host.shadowRoot;
      if (!root) continue;
      if (!observedRoots.has(root)) {
        observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['aria-hidden'] });
        observedRoots.add(root);
      }
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
    requestAnimationFrame(syncPopup);
  }

  observer = new MutationObserver(scheduleSync);
  observer.observe(document.body, { childList: true, subtree: true });
  document.addEventListener('click', event => {
    const control = event.composedPath().find(node => node.matches?.('.es-text-shortener-control-open[aria-haspopup="dialog"]'));
    if (control && !popup) trigger = control;
    scheduleSync();
  }, true);
  window.addEventListener('message', event => {
    if (event.origin === site && event.source === window.parent && event.data?.type === 'fireart:close-review-dialog') {
      popup?.querySelector('.es-popup-close-button')?.click();
    }
  });
  syncPopup();
})();
