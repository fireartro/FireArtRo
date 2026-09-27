import { fetchPublishedRevision } from './contentApi';

const PUBLICATION_KEY = 'fireartro-publication';
const validRevision = value => typeof value === 'string' && /^[a-z0-9][a-z0-9-]{0,79}$/i.test(value);

export function announcePublication(revisionId) {
  if (!validRevision(revisionId)) return;
  try { window.localStorage.setItem(PUBLICATION_KEY, JSON.stringify({revision_id: revisionId})); }
  catch { /* Storage restrictions do not invalidate a confirmed server publication. */ }
}

export function watchPublications({getRevision, refresh, windowLike = window, documentLike = document}) {
  let disposed = false;
  let busy = false;
  let immediate = false;
  let timer;
  let deadline;
  let controller;
  let failures = 0;
  const available = () => documentLike.visibilityState !== 'hidden' && windowLike.navigator.onLine !== false;
  const schedule = delay => {
    windowLike.clearTimeout(timer);
    if (!disposed && available()) timer = windowLike.setTimeout(check, delay);
  };
  const check = async () => {
    if (disposed || !available()) return;
    if (busy) { immediate = true; return; }
    busy = true;
    controller = new AbortController();
    const active = controller;
    try {
      const metadata = await Promise.race([
        fetchPublishedRevision({signal: active.signal, revisionId: getRevision()}),
        new Promise((_, reject) => {
          deadline = windowLike.setTimeout(() => { active.abort(); reject(new Error('Revision check timed out')); }, 15000);
        }),
      ]);
      if (disposed || active.signal.aborted || !available()) return;
      if ((!getRevision() || (metadata && metadata.revision_id !== getRevision())) && await refresh() === false) {
        throw new Error('Publication refresh failed');
      }
      failures = 0;
    } catch {
      if (!disposed && !active.signal.aborted) failures += 1;
      else if (!disposed && available()) failures += 1;
    } finally {
      windowLike.clearTimeout(deadline);
      busy = false;
      controller = null;
      const delay = immediate ? 0 : Math.min(5000 * 2 ** Math.min(failures, 4), 60000);
      immediate = false;
      schedule(delay);
    }
  };
  const resume = () => {
    windowLike.clearTimeout(timer);
    if (available()) schedule(0);
    else { immediate = false; controller?.abort(); }
  };
  const notified = event => {
    if (event.key !== PUBLICATION_KEY || !event.newValue || !available()) return;
    try {
      const {revision_id: id} = JSON.parse(event.newValue);
      if (validRevision(id) && id !== getRevision()) schedule(0);
    } catch { /* An invalid message is not a content source. */ }
  };
  documentLike.addEventListener('visibilitychange', resume);
  windowLike.addEventListener('online', resume);
  windowLike.addEventListener('offline', resume);
  windowLike.addEventListener('storage', notified);
  schedule(5000);
  return () => {
    disposed = true;
    controller?.abort();
    windowLike.clearTimeout(timer);
    windowLike.clearTimeout(deadline);
    documentLike.removeEventListener('visibilitychange', resume);
    windowLike.removeEventListener('online', resume);
    windowLike.removeEventListener('offline', resume);
    windowLike.removeEventListener('storage', notified);
  };
}
