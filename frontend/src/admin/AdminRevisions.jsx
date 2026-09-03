import { useEffect, useState } from 'react';
import { useAdminSession } from './AdminSessionContext';
import { useAdminDraft } from './AdminDraftContext';
import AdminDialog from './AdminDialog';

export default function AdminRevisions() {
  const { request } = useAdminSession();
  const { restoreRevision, status, dirty, pendingUploads, publishedRevisionId } = useAdminDraft();
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let current = true;
    request('/api/admin/content/revisions').then(result => { if (current) setItems(result); })
      .catch(err => { if (current) setError(err.message); }).finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [request, publishedRevisionId]);
  return <section className="cms-panel"><h1>Istoric publicări</h1><p>Fiecare publicare păstrează o copie completă a site-ului.</p>
    {loading && <p role="status">Se încarcă versiunile…</p>}
    {error && <p role="alert">{error}</p>}
    <ol className="cms-revision-list">{items.map(item => <li key={item.id}>
      <div><strong>{item.summary || 'Publicare fără notă'}</strong><p>{new Date(item.published_at).toLocaleString('ro-RO')} · {item.published_by}</p>
        {item.id === publishedRevisionId && <small>Versiunea publică actuală</small>}</div>
      <button className="admin-button" onClick={() => setSelected(item)} disabled={status !== 'saved' || dirty || pendingUploads > 0}>Restaurează ca draft</button>
    </li>)}</ol>
    <AdminDialog open={Boolean(selected)} onOpenChange={open => { if (!open) setSelected(null); }} title="Restaurează ca draft"
      description="Conținutul acestei versiuni va înlocui draftul salvat. Site-ul public rămâne la versiunea actuală până când publici din nou.">
      <p>{selected?.summary || 'Versiunea selectată'}</p>
      <button className="admin-button is-primary" disabled={status !== 'saved' || dirty || pendingUploads > 0} onClick={async () => {
        if (await restoreRevision(selected.id)) setSelected(null);
      }}>Restaurează ca draft</button>
    </AdminDialog>
  </section>;
}
