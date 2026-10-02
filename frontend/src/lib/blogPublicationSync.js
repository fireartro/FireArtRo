import { fetchBlogRevision } from "./blogApi";

const CHANGE_KEY = "fireartro-blog-publication";

export function announceBlogChange() {
  window.dispatchEvent(new Event(CHANGE_KEY));
  try { window.localStorage.setItem(CHANGE_KEY, JSON.stringify({ changed_at: Date.now() })); }
  catch { /* Polling remains available when storage is restricted. */ }
}

// Each mounted consumer owns its request/refresh lifecycle. Signals contain no
// editorial data: both same-tab and cross-tab events only request a public check.
export function watchBlogPublications({ refresh, windowLike = window, documentLike = document }) {
  let disposed = false, busy = false, immediate = false;
  let timer, deadline, controller, revision;
  let failures = 0;
  const available = () => documentLike.visibilityState !== "hidden" && windowLike.navigator.onLine !== false;
  const schedule = (delay) => {
    windowLike.clearTimeout(timer);
    if (!disposed && available()) timer = windowLike.setTimeout(check, delay);
  };
  const check = async () => {
    if (disposed || !available()) return;
    if (busy) { immediate = true; return; }
    busy = true;
    const active = new AbortController();
    controller = active;
    try {
      const refreshIfChanged = async () => {
        const metadata = await fetchBlogRevision({ signal: active.signal, revisionId: revision });
        if (disposed || active.signal.aborted || !available()) return;
        if (metadata && metadata.revision_id !== revision) {
          if (await refresh({ signal: active.signal }) === false) throw new Error("Blog refresh failed");
          if (disposed || active.signal.aborted || !available()) return;
          revision = metadata.revision_id;
        }
      };
      await Promise.race([
        refreshIfChanged(),
        new Promise((_, reject) => {
          deadline = windowLike.setTimeout(() => { active.abort(); reject(new Error("Blog revision timed out")); }, 15000);
        }),
      ]);
      if (disposed || active.signal.aborted || !available()) return;
      failures = 0;
    } catch {
      if (!disposed && available()) failures = Math.min(failures + 1, 4);
    } finally {
      windowLike.clearTimeout(deadline);
      busy = false; controller = null;
      const delay = immediate ? 0 : Math.min(5000 * 2 ** failures, 60000);
      immediate = false;
      schedule(delay);
    }
  };
  const resume = () => {
    windowLike.clearTimeout(timer);
    if (available()) schedule(0);
    else { immediate = false; controller?.abort(); }
  };
  const storageChanged = (event) => {
    if (event.key === CHANGE_KEY && event.newValue) resume();
  };
  documentLike.addEventListener("visibilitychange", resume);
  windowLike.addEventListener("focus", resume);
  windowLike.addEventListener("online", resume);
  windowLike.addEventListener("offline", resume);
  windowLike.addEventListener(CHANGE_KEY, resume);
  windowLike.addEventListener("storage", storageChanged);
  schedule(5000);
  return () => {
    disposed = true;
    controller?.abort();
    windowLike.clearTimeout(timer); windowLike.clearTimeout(deadline);
    documentLike.removeEventListener("visibilitychange", resume);
    windowLike.removeEventListener("focus", resume);
    windowLike.removeEventListener("online", resume);
    windowLike.removeEventListener("offline", resume);
    windowLike.removeEventListener(CHANGE_KEY, resume);
    windowLike.removeEventListener("storage", storageChanged);
  };
}
