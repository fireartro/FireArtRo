import { normalizePublishedContent, validateManagedContent } from '@/content/managedContentSchema';
import { fetchPublishedContent } from '@/lib/contentApi';

export function setContentPath(content, path, value) {
  const keys = Array.isArray(path) ? path : path.split('.');
  if (keys.some(key => ['__proto__', 'constructor', 'prototype'].includes(String(key)))) throw new Error('Câmp invalid.');
  if (!keys.length || !keys[0]) return value;
  const [key, ...rest] = keys;
  const next = Array.isArray(content) ? [...content] : { ...content };
  next[key] = rest.length ? setContentPath(content?.[key], rest, value) : value;
  return next;
}

export const changedModules = (before, after) => after ? Object.keys(after).filter(key => key !== 'schema_version' && JSON.stringify(before?.[key]) !== JSON.stringify(after[key])) : [];

export function createDraftStore(request, getPublication = fetchPublishedContent) {
  let state = { draft: null, version: null, publishedContent: null, publishedRevisionId: null,
    status: 'loading', dirty: false, errors: [], error: '', pendingUploads: 0 };
  let generation = 0;
  let operation = 0;
  let busy = false;
  let history = [];
  const listeners = new Set();
  const emit = patch => { state = { ...state, ...patch }; listeners.forEach(listener => listener()); };
  const accept = payload => {
    if (!Number.isInteger(payload.version) || payload.version < 0) throw new Error('Versiunea draftului nu este validă.');
    return { draft: normalizePublishedContent(payload.content), version: payload.version,
      publishedRevisionId: payload.published_revision_id, publishedAt: payload.published_at, updatedAt: payload.updated_at };
  };
  const failure = error => emit({
    status: error.status === 409 ? 'conflict' : error.status === 401 ? 'expired' : error.status === 422 ? 'invalid' : 'error',
    error: error.message || 'Operațiunea nu a putut fi finalizată.',
    errors: Array.isArray(error.payload?.detail) ? error.payload.detail.map(item => ({
      path: (item.loc || []).filter(part => part !== 'body' && part !== 'content').join('.'), message: item.msg,
    })) : state.errors,
  });
  const store = {
    getSnapshot: () => state,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    async load({ discard = false } = {}) {
      if (busy) return;
      busy = true;
      const ticket = ++operation;
      emit({ status: 'loading', error: '' });
      try {
        const [payload, publication] = await Promise.all([request('/api/admin/content/draft'), getPublication().catch(() => null)]);
        if (ticket !== operation) return;
        const incoming = accept(payload);
        const publicPatch = publication ? { publishedContent: normalizePublishedContent(publication.content) } : {};
        if (state.dirty && !discard) {
          emit({ ...publicPatch, status: incoming.version === state.version ? 'dirty' : 'conflict', error: incoming.version === state.version ? '' : 'Draftul a fost modificat într-o altă fereastră. Varianta ta este păstrată.' });
        } else {
          history = [];
          emit({ ...incoming, ...publicPatch, status: 'saved', dirty: false, errors: [], error: '' });
        }
      } catch (error) {
        if (ticket !== operation) return;
        if (error.status === 404 && !state.draft) emit({ status: 'uninitialized', error: '' });
        else failure(error);
      } finally { busy = false; }
    },
    update(path, value) {
      if (!state.draft || ['loading', 'publishing', 'restoring', 'expired'].includes(state.status)) return;
      history = [...history.slice(-19), state.draft];
      generation += 1;
      emit({ draft: setContentPath(state.draft, path, value), dirty: true, errors: [], error: '',
        status: state.status === 'conflict' ? 'conflict' : busy ? state.status : 'dirty' });
    },
    undo() {
      if (!history.length || busy) return;
      const previous = history.pop();
      generation += 1;
      emit({ draft: previous, dirty: true, errors: [], error: '', status: state.status === 'conflict' ? 'conflict' : 'dirty' });
    },
    setPendingUploads(count) { emit({ pendingUploads: Math.max(0, typeof count === 'function' ? count(state.pendingUploads) : count) }); },
    async save() {
      if (busy || !state.dirty || state.pendingUploads || ['conflict', 'expired'].includes(state.status)) return false;
      const parsed = validateManagedContent(state.draft);
      if (parsed.errors.length) { emit({ status: 'invalid', errors: parsed.errors }); return false; }
      busy = true;
      const editedAt = generation;
      emit({ status: 'saving', error: '' });
      try {
        const result = accept(await request('/api/admin/content/draft', { method: 'PUT', body: JSON.stringify({ version: state.version, content: parsed.content }) }));
        const unchanged = editedAt === generation;
        emit({ ...result, draft: unchanged ? result.draft : state.draft, dirty: !unchanged, status: unchanged ? 'saved' : 'dirty', errors: [] });
        return unchanged;
      } catch (error) { failure(error); return false; }
      finally { busy = false; }
    },
    async publish(summary = '') {
      if (busy || state.dirty || state.pendingUploads || state.status !== 'saved') return false;
      const parsed = validateManagedContent(state.draft);
      if (parsed.errors.length) { emit({ status: 'invalid', errors: parsed.errors }); return false; }
      busy = true;
      emit({ status: 'publishing', error: '' });
      try {
        const result = await request('/api/admin/content/publish', { method: 'POST', body: JSON.stringify({ version: state.version, summary }) });
        const incoming = accept(result.draft);
        emit({ ...incoming, publishedContent: normalizePublishedContent(result.publication.content), status: 'saved', dirty: false, errors: [] });
        return true;
      } catch (error) { failure(error); return false; }
      finally { busy = false; }
    },
    async restoreRevision(id) {
      if (busy || state.dirty || state.pendingUploads || state.status !== 'saved') return false;
      busy = true;
      emit({ status: 'restoring', error: '' });
      try {
        const result = await request(`/api/admin/content/revisions/${encodeURIComponent(id)}/restore`, { method: 'POST', body: JSON.stringify({ version: state.version }) });
        history = [];
        emit({ ...accept(result), status: 'saved', dirty: false, errors: [] });
        return true;
      } catch (error) { failure(error); return false; }
      finally { busy = false; }
    },
    async bootstrap(content) {
      if (busy || state.status !== 'uninitialized') return false;
      busy = true;
      emit({ status: 'loading', error: '' });
      try {
        const result = await request('/api/admin/content/bootstrap', { method: 'POST', body: JSON.stringify(content) });
        emit({ ...accept(result.draft), publishedContent: normalizePublishedContent(result.publication.content), status: 'saved', dirty: false, errors: [] });
        return true;
      } catch (error) { emit({ status: 'uninitialized', error: error.message }); return false; }
      finally { busy = false; }
    },
  };
  return store;
}
