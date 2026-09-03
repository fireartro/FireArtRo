import { useCallback, useEffect, useRef, useState } from 'react';
import { useAdminSession } from './AdminSessionContext';
import { useAdminDraft } from './AdminDraftContext';
import { deleteMedia, getMedia, listMedia, reconcilePendingMedia, updateMediaAlt, uploadMediaFile } from '@/lib/mediaApi';
import { createDraftMediaItem } from './mediaDraftItem';

const categoryOptions = ['Artificii de zi', 'Artificii de noapte', 'Drone show', 'Drone + artificii', 'Efecte speciale', 'Corporate / Festival', 'Festival', 'Nuntă', 'Corporate', 'Promoții'];
const wait = delay => new Promise(resolve => setTimeout(resolve, delay));
export default function AdminMediaLibrary() {
  const { request, csrfToken } = useAdminSession();
  const { draft, update, setPendingUploads } = useAdminDraft();
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  const [progress, setProgress] = useState(0);
  const [title, setTitle] = useState('');
  const [alt, setAlt] = useState('');
  const [category, setCategory] = useState('Artificii de noapte');
  const [file, setFile] = useState(null);
  const fileRef = useRef(null);
  const load = useCallback(async () => { setStatus('loading'); setError(''); try { setItems(await listMedia(request)); setStatus('ready'); } catch (failure) { setError(failure.message); setStatus('error'); } }, [request]);
  useEffect(() => { load(); }, [load]);
  const attach = (item, overrides = {}) => {
    const existing = draft.mediaItems.find(media => media.id === item.id);
    const media = createDraftMediaItem(item, {
      ...overrides,
      order: existing?.order || draft.mediaItems.length + 1,
    });
    update('mediaItems', existing ? draft.mediaItems.map(current => current.id === item.id ? media : current) : [...draft.mediaItems, media]);
  };
  const submit = async event => {
    event.preventDefault(); if (!file || !title.trim() || !alt.trim()) return;
    setError(''); setProgress(0); setStatus('uploading'); setPendingUploads(value => value + 1);
    try {
      const { id } = await uploadMediaFile(file, { csrfToken, altText: alt, onProgress: event => setProgress(Math.round(event.percentage || 0)) });
      let persisted;
      for (let attempt = 0; attempt < 15 && !persisted; attempt += 1) { try { persisted = await getMedia(request, id); } catch { await wait(400); } }
      if (!persisted) {
        setFile(null); setTitle(''); setAlt(''); if (fileRef.current) fileRef.current.value = '';
        await load();
        setError('Fișierul a fost trimis, dar confirmarea stocării întârzie. Verifică încărcarea din cardul lui înainte să îl adaugi în draft.');
        return;
      }
      attach(persisted, { title, alt, category }); setItems(current => [persisted, ...current]); setFile(null); setTitle(''); setAlt(''); if (fileRef.current) fileRef.current.value = ''; setStatus('ready');
    } catch (failure) { setError(failure.message); setStatus('error'); }
    finally { setPendingUploads(value => value - 1); }
  };
  return <section className="cms-panel"><h1>Biblioteca media</h1><p>Încarcă imagini și video, apoi folosește-le în pagini, pachete și galerie.</p>
    <form className="cms-media-upload cms-form-grid" onSubmit={submit}>
      <label className="admin-field">Fișier<input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/avif,video/mp4,video/webm" onChange={event => setFile(event.target.files?.[0] || null)} /></label>
      <label className="admin-field">Titlu<input value={title} maxLength={160} required onChange={event => setTitle(event.target.value)} /></label>
      <label className="admin-field admin-field-wide">Text alternativ<textarea value={alt} maxLength={240} required onChange={event => setAlt(event.target.value)} /></label>
      <label className="admin-field">Categorie<select value={category} onChange={event => setCategory(event.target.value)}>{categoryOptions.map(option => <option key={option}>{option}</option>)}</select></label>
      <button className="admin-button is-primary" disabled={status === 'uploading'}>{status === 'uploading' ? `Se încarcă ${progress}%` : 'Încarcă și adaugă în draft'}</button>
    </form>
    {error && <div role="alert" className="cms-notice is-error">{error}<button className="admin-button" onClick={load}>Reîncarcă</button></div>}
    {status === 'loading' && <p role="status">Se încarcă biblioteca…</p>}
    <div className="cms-media-grid">{items.map(item => <MediaCard key={item.id} item={item} request={request} attached={draft.mediaItems.some(media => media.id === item.id)} onAttach={() => attach(item)} onDeleted={() => setItems(current => current.filter(value => value.id !== item.id))} onUpdated={next => setItems(current => current.map(value => value.id === next.id ? next : value))} />)}</div>
  </section>;
}
export function MediaCard({ item, request, attached, onAttach, onDeleted, onUpdated }) {
  const [alt, setAlt] = useState(item.alt_text || ''); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const pending = item.state === 'pending'; const deleting = item.state === 'deleting'; const ready = item.state === 'ready'; const hasPreview = Boolean(item.url); const size = item.size ?? item.declared_size ?? 0;
  const reconcile = async () => { setBusy(true); setError(''); try { await reconcilePendingMedia(request, item.id); onUpdated(await getMedia(request, item.id)); } catch (failure) { setError(failure.message); } finally { setBusy(false); } };
  return <article className="cms-media-card">{!hasPreview ? <div className="cms-media-pending" role="status">{pending ? 'Confirmarea fișierului este în curs' : 'Ștergerea fișierului poate fi reluată'}</div> : item.content_type.startsWith('image/') ? <img src={item.url} alt={item.alt_text || ''} loading="lazy" /> : <video src={item.url} controls preload="metadata" />}
    <strong>{item.filename}</strong><small>{Math.round(size / 1024)} KB · {pending ? 'așteaptă confirmarea stocării' : deleting ? 'ștergerea poate fi reluată' : `folosit în ${item.usage_count} locuri`}</small>
    {deleting && <small className="cms-media-state">Ștergerea nu a fost încă confirmată de stocare.</small>}
    <label className="admin-field">Text alternativ<input value={alt} maxLength={240} disabled={!ready} onChange={event => setAlt(event.target.value)} /></label>
    <div className="cms-row-actions"><button type="button" className="admin-button" disabled={busy || attached || !ready} onClick={onAttach}>{attached ? 'Este în draft' : 'Adaugă în draft'}</button><button type="button" className="admin-button" disabled={busy || !ready || alt === item.alt_text} onClick={async () => { setBusy(true); setError(''); try { onUpdated(await updateMediaAlt(request, item.id, alt)); } catch (failure) { setError(failure.message); } finally { setBusy(false); } }}>Salvează descrierea</button>
      {pending && <button type="button" className="admin-button" disabled={busy} onClick={reconcile}>Verifică încărcarea</button>}
      <button type="button" className="admin-button is-danger-quiet" disabled={busy || item.usage_count > 0} title={item.usage_count ? 'Fișierul este folosit și rămâne protejat.' : ''} onClick={async () => { if (!window.confirm(`Ștergi definitiv ${item.filename}?`)) return; setBusy(true); try { await deleteMedia(request, item.id); onDeleted(); } catch (failure) { setError(failure.message); } finally { setBusy(false); } }}>{pending ? 'Șterge încărcarea' : deleting ? 'Reîncearcă ștergerea' : 'Șterge definitiv'}</button></div>
    {error && <small role="alert" className="cms-error">{error}</small>}
  </article>;
}
