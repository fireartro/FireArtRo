import { createContext, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useAdminSession } from './AdminSessionContext';
import { useManagedContentSnapshot } from '@/content/ManagedContentProvider';
import { createDraftStore, changedModules } from './draftStore';

const Context = createContext(null);
export function AdminDraftProvider({ children }) {
  const session = useAdminSession();
  const publicContent = useManagedContentSnapshot();
  const requestRef = useRef(session.request);
  requestRef.current = session.request;
  const [store] = useState(() => createDraftStore((...args) => requestRef.current(...args)));
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  const [previewMode, setPreviewMode] = useState(false);
  useEffect(() => { if (session.status === 'authenticated') store.load(); }, [store, session.status]);
  useEffect(() => {
    if (state.status !== 'dirty' || state.pendingUploads || session.status !== 'authenticated') return;
    const timer = setTimeout(() => store.save(), 700);
    return () => clearTimeout(timer);
  }, [state.draft, state.status, state.pendingUploads, store, session.status]);
  useEffect(() => {
    const warn = event => { if (state.dirty || state.pendingUploads) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [state.dirty, state.pendingUploads]);
  const value = useMemo(() => ({ ...state, update: store.update, undo: store.undo, save: store.save,
    retry: () => state.dirty ? store.save() : store.load(), reloadAfterConflict: () => store.load({ discard: true }),
    restoreRevision: store.restoreRevision, bootstrap: store.bootstrap, setPendingUploads: store.setPendingUploads,
    publish: async summary => { const success = await store.publish(summary); if (success) publicContent.refresh(); return success; },
    changedModules: changedModules(state.publishedContent, state.draft), previewMode, setPreviewMode,
  }), [state, store, publicContent, previewMode]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useAdminDraft() {
  const value = useContext(Context);
  if (!value) throw new Error('Editorul are nevoie de AdminDraftProvider.');
  return value;
}
