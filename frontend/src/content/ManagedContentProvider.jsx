import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { CMS_DEFAULTS } from '@/data/cmsDefaults';
import { fetchPublishedContent } from '@/lib/contentApi';
import { normalizePublishedContent } from './managedContentSchema';

const fallback = { content: CMS_DEFAULTS, revisionId: 'fallback', status: 'fallback', refresh: async () => {} };
const loading = { content: null, revisionId: null, status: 'loading', refresh: async () => {} };
const unavailable = { content: null, revisionId: null, status: 'unavailable', refresh: async () => {} };
const ManagedContentContext = createContext(fallback);
export const useManagedContentSnapshot = () => useContext(ManagedContentContext);
export function createPublicContentState({ production = process.env.NODE_ENV === 'production' } = {}) {
  return production ? loading : fallback;
}
export function publicContentAfterFailure(previous, { production = process.env.NODE_ENV === 'production' } = {}) {
  return production && previous.status !== 'ready' ? unavailable : previous;
}

export function ManagedContentProvider({ children }) {
  const [state, setState] = useState(createPublicContentState);
  const location = useLocation();
  const revision = useRef(null);
  const activeRequest = useRef(null);
  const sequence = useRef(0);
  const refresh = useCallback(async () => {
    activeRequest.current?.abort();
    const controller = new AbortController();
    activeRequest.current = controller;
    const operation = ++sequence.current;
    try {
      const publication = await fetchPublishedContent({ signal: controller.signal, revisionId: revision.current });
      if (!publication || controller.signal.aborted || operation !== sequence.current) return;
      if (typeof publication.revision_id !== 'string' || !publication.revision_id || !publication.published_at) throw new Error('Versiune invalidă.');
      const content = normalizePublishedContent(publication.content);
      revision.current = publication.revision_id;
      setState({ content, revisionId: publication.revision_id, status: 'ready' });
    } catch {
      if (!controller.signal.aborted && operation === sequence.current) {
        setState(current => publicContentAfterFailure(current));
      }
    }
  }, []);
  useEffect(() => { refresh(); }, [refresh, location.pathname]);
  useEffect(() => {
    const onFocus = () => { if (document.visibilityState === 'visible') refresh(); };
    document.addEventListener('visibilitychange', onFocus);
    return () => { document.removeEventListener('visibilitychange', onFocus); activeRequest.current?.abort(); };
  }, [refresh]);
  const value = useMemo(() => ({ ...state, refresh }), [state, refresh]);
  return <ManagedContentContext.Provider value={value}>{children}</ManagedContentContext.Provider>;
}

// Mounted exclusively in the authenticated preview; no fetch or persistence.
export function DraftPreviewProvider({ content, children }) {
  const value = useMemo(() => ({ content, revisionId: 'draft', status: 'preview', preview: true }), [content]);
  return <ManagedContentContext.Provider value={value}>{children}</ManagedContentContext.Provider>;
}
