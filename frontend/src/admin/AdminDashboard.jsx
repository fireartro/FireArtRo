import { useAdminDraft } from './AdminDraftContext';
import AdminMigrationPanel from './AdminMigrationPanel';
import AdminIntegrations from './AdminIntegrations';

const STATUS = { loading: 'Se încarcă draftul', dirty: 'Modificări nesalvate', saving: 'Se salvează', saved: 'Draft salvat',
  invalid: 'Corectează câmpurile', conflict: 'Conflict între ferestre', error: 'Salvarea a eșuat', publishing: 'Se publică', restoring: 'Se restaurează' };
export default function AdminDashboard({ onEdit, onPreview, onPublish }) {
  const draft = useAdminDraft();
  return <section className="cms-dashboard">
    <header><p className="admin-auth-kicker">CONTROL EDITORIAL</p><h1>Conținutul site-ului, într-un singur loc.</h1>
      <p>Modificările se salvează în draft și apar public numai după publicare.</p></header>
    <div className="cms-metric-grid">
      <article><span>Stare draft</span><strong>{STATUS[draft.status] || draft.status}</strong><small>{draft.dirty ? 'Așteaptă confirmarea serverului' : 'Confirmat de server'}</small></article>
      <article><span>Modificări nepublicate</span><strong>{draft.changedModules.length}</strong><small>{draft.changedModules.length ? 'secțiuni diferite de site-ul public' : 'Draftul coincide cu versiunea publică'}</small></article>
      <article><span>Versiune publică</span><strong>{draft.publishedRevisionId?.slice(0, 8) || '—'}</strong><small>{draft.publishedAt ? new Date(draft.publishedAt).toLocaleString('ro-RO') : 'Nepublicat încă'}</small></article>
    </div>
    <div className="cms-dashboard-actions"><button className="admin-button" onClick={onEdit}>Continuă editarea</button>
      <button className="admin-button" onClick={onPreview} disabled={!draft.draft}>Previzualizează</button>
      <button className="admin-button is-primary" onClick={onPublish} disabled={draft.status !== 'saved' || !draft.changedModules.length}>Publică modificările</button></div>
    <AdminIntegrations />
    <AdminMigrationPanel />
    {draft.error && <div className="cms-notice is-error" role="alert"><strong>{draft.error}</strong>
      {draft.status === 'conflict' ? <button className="admin-button" onClick={draft.reloadAfterConflict}>Încarcă versiunea serverului</button> : <button className="admin-button" onClick={draft.retry}>Încearcă din nou</button>}</div>}
    {draft.errors.length > 0 && <div className="cms-notice is-error" role="alert"><strong>{draft.errors.length} câmpuri trebuie corectate înainte de publicare.</strong></div>}
  </section>;
}
