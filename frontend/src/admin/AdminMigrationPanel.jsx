import { useMemo, useState } from 'react';
import { MANAGED_CONTENT_STORAGE_KEY, readManagedContent } from '@/hooks/useManagedContent';
import { CMS_DEFAULTS } from '@/data/cmsDefaults';
import { validateManagedContent } from '@/content/managedContentSchema';
import { useAdminDraft } from './AdminDraftContext';
import AdminDialog from './AdminDialog';

const knownKeys = Object.keys(CMS_DEFAULTS).filter(key => key !== 'schema_version');
const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const plainRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);

function mergeKnown(current, legacy) {
  if (Array.isArray(legacy) || !plainRecord(current) || !plainRecord(legacy)) return legacy;
  return Object.fromEntries(Object.keys(current).map(key => [
    key,
    own(legacy, key) ? mergeKnown(current[key], legacy[key]) : current[key],
  ]));
}

export function prepareLegacyImport(current, legacy) {
  if (!plainRecord(legacy)) return { content: null, modules: [], errors: ['Datele locale nu pot fi citite.'] };
  const modules = knownKeys.filter(key => own(legacy, key));
  if (!modules.length) return { content: null, modules, errors: ['Nu există câmpuri compatibile de importat.'] };
  const candidate = { ...current };
  modules.forEach(key => { candidate[key] = mergeKnown(current[key], legacy[key]); });
  const result = validateManagedContent(candidate);
  return { content: result.content, modules, errors: result.errors.map(error => error.message) };
}

export default function AdminMigrationPanel() {
  const { draft, update, status } = useAdminDraft();
  const [open, setOpen] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const legacy = useMemo(() => readManagedContent(), []);
  const prepared = useMemo(() => prepareLegacyImport(draft, legacy), [draft, legacy]);
  if (deleted || !prepared.modules.length) return null;

  const importDraft = () => {
    if (!prepared.content || status !== 'saved') return;
    // An empty path deliberately replaces the in-memory draft only. Autosave remains
    // responsible for the protected server write and publishing remains explicit.
    update([], prepared.content);
  };

  return <section className="cms-migration cms-notice">
    <div><strong>Draft local găsit</strong><p>Poți importa {prepared.modules.length} secțiuni editate anterior în acest browser. Importul actualizează numai draftul; nu publică nimic.</p></div>
    {prepared.content ? <button className="admin-button" disabled={status !== 'saved'} onClick={importDraft}>Importă în draft</button>
      : <p role="alert" className="cms-error">Importul nu este sigur: {prepared.errors[0]}</p>}
    <button className="admin-button is-danger-quiet" onClick={() => setOpen(true)}>Șterge datele locale vechi</button>
    <AdminDialog open={open} onOpenChange={setOpen} title="Șterge draftul local" description={`Ștergi definitiv cheia locală ${MANAGED_CONTENT_STORAGE_KEY}? Nu afectează site-ul public sau draftul de pe server.`}>
      <button className="admin-button is-danger-quiet" onClick={() => { window.localStorage.removeItem(MANAGED_CONTENT_STORAGE_KEY); setDeleted(true); setOpen(false); }}>Șterge datele locale</button>
    </AdminDialog>
  </section>;
}
