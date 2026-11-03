/* Shared by React and the early startup script; build copies this exact file. */
(function expose(scope, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory;
  else scope.__fireartCreateHeroDownloads = factory;
})(typeof window === 'undefined' ? globalThis : window, function createHeroDownloads(options = {}) {
  const fetchMedia = options.fetchMedia || fetch;
  const makeURL = options.createObjectURL || (blob => URL.createObjectURL(blob));
  const revokeURL = options.revokeObjectURL || (url => URL.revokeObjectURL(url));
  const later = options.setTimeout || setTimeout;
  const cancel = options.clearTimeout || clearTimeout;
  const records = new Map();
  const listeners = new Set();
  let playlist = [];
  let queue = [];
  let active = null;
  let retryTimer;
  let generation = 0;
  const notify = () => listeners.forEach(listener => listener());
  const abortError = () => Object.assign(new Error('Hero playlist changed'), { name: 'AbortError' });

  function recordFor(src) {
    if (!records.has(src)) {
      const record = { status: 'idle', attempts: 0 };
      record.promise = new Promise((resolve, reject) => { record.resolve = resolve; record.reject = reject; });
      // The early buffer and background queue can precede React subscribers.
      record.promise.catch(() => {});
      records.set(src, record);
    }
    return records.get(src);
  }

  async function work() {
    if (active || retryTimer !== undefined || !queue.length) return;
    const src = queue.shift();
    const record = recordFor(src);
    const epoch = generation;
    const controller = new AbortController();
    active = { src, controller };
    record.status = 'loading';
    record.error = undefined;
    notify();
    try {
      const response = await fetchMedia(src, { signal: controller.signal, credentials: 'omit', cache: record.refresh ? 'reload' : 'force-cache' });
      if (response.status !== 200 || !response.headers.get('content-type')?.startsWith('video/')) throw new Error('Complete hero film unavailable');
      let blob;
      record.loaded = 0;
      record.total = Number(response.headers.get('content-length')) || 0;
      if (response.body?.getReader) {
        const reader = response.body.getReader();
        const chunks = [];
        let reported = 0;
        while (true) {
          const chunk = await reader.read();
          if (chunk.done) break;
          if (epoch !== generation || controller.signal.aborted) return;
          chunks.push(chunk.value);
          record.loaded += chunk.value.byteLength;
          if (Date.now() - reported >= 250) { reported = Date.now(); notify(); }
        }
        blob = new Blob(chunks, { type: response.headers.get('content-type') });
      } else blob = await response.blob();
      if (epoch !== generation || controller.signal.aborted) return;
      if (!blob.size) throw new Error('Empty hero film');
      if (record.total && blob.size !== record.total) throw new Error('Incomplete hero film');
      record.url = makeURL(blob);
      record.bytes = blob.size;
      record.loaded = blob.size;
      record.status = 'ready';
      record.resolve(record.url);
      active = null;
      notify();
      work();
    } catch (error) {
      if (epoch !== generation || controller.signal.aborted) return;
      // An error may reject headers before its response body has stopped.
      // Close that transfer before releasing the single download slot.
      controller.abort();
      record.status = 'error';
      record.refresh = true;
      record.error = error;
      active = null;
      // Keep the failed chapter ahead of later chapters. A retry never
      // promotes file3 ahead of an incomplete file2.
      queue.unshift(src);
      retryTimer = later(() => { retryTimer = undefined; work(); }, Math.min(1000 * 2 ** record.attempts++, 8000));
      notify();
    }
  }

  function enqueue(src, priority = false) {
    const record = recordFor(src);
    if (record.status !== 'ready' && active?.src !== src && !queue.includes(src)) {
      if (priority) queue.unshift(src);
      else queue.push(src);
      work();
    }
    return record.promise;
  }

  function clear() {
    generation += 1;
    cancel(retryTimer);
    retryTimer = undefined;
    active?.controller.abort();
    active = null;
    queue = [];
    playlist = [];
    records.forEach(record => {
      if (record.url) revokeURL(record.url);
      else record.reject(abortError());
    });
    records.clear();
    notify();
  }

  return {
    prepare(sources, index = 0) {
      if (sources.join('|') !== playlist.join('|')) {
        clear();
        playlist = [...sources];
      }
      return enqueue(playlist[index], true);
    },
    preloadFollowing(index) {
      for (let offset = 1; offset < playlist.length; offset += 1) enqueue(playlist[(index + offset) % playlist.length]);
    },
    get(src) { return records.get(src) || { status: 'idle' }; },
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    retry() { cancel(retryTimer); retryTimer = undefined; work(); },
    reload(src) {
      const previous = records.get(src);
      if (previous?.status !== 'ready') return enqueue(src, true);
      cancel(retryTimer); retryTimer = undefined;
      if (active) {
        const interrupted = active;
        active = null;
        interrupted.controller.abort();
        recordFor(interrupted.src).status = 'idle';
        if (!queue.includes(interrupted.src)) queue.unshift(interrupted.src);
      }
      revokeURL(previous.url);
      records.delete(src);
      recordFor(src).refresh = true;
      return enqueue(src, true);
    },
    clear,
  };
});
