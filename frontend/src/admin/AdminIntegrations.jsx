import { useCallback, useEffect, useState } from 'react';
import { getIntegrationStatus } from '@/lib/integrationsApi';
import { useAdminSession } from './AdminSessionContext';

const INTEGRATIONS = [
  ['database', 'Baza de date'],
  ['blob', 'Biblioteca media'],
  ['google', 'Recenzii Google'],
  ['facebook', 'Recenzii Facebook'],
];

function stateCopy(value) {
  if (!value?.configured) return 'Necesită configurare';
  if (value.healthy === true) return 'Funcțional';
  if (value.healthy === false) return 'Eroare temporară';
  return 'Configurat';
}

export default function AdminIntegrations() {
  const { status: sessionStatus, request } = useAdminSession();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async (refresh = false) => {
    setLoading(true);
    setError('');
    try {
      setData(await getIntegrationStatus(request, { refresh }));
    } catch {
      setError('Starea integrărilor nu poate fi încărcată momentan.');
    } finally {
      setLoading(false);
    }
  }, [request]);

  useEffect(() => {
    if (sessionStatus === 'authenticated') load();
  }, [load, sessionStatus]);

  if (sessionStatus !== 'authenticated') return null;

  return <section className="cms-panel cms-integrations" aria-labelledby="cms-integrations-title">
    <header className="cms-panel-heading"><div><h2 id="cms-integrations-title">Starea integrărilor</h2>
      <p>Verifică disponibilitatea serviciilor fără a afișa parole sau tokenuri.</p></div>
      <button className="admin-button" disabled={loading} onClick={() => load(true)}>Verifică din nou</button></header>
    {loading && !data ? <p role="status">Se verifică integrările…</p> : null}
    {error ? <div className="cms-notice is-error" role="alert">{error}</div> : null}
    {data ? <div className="cms-metric-grid">{INTEGRATIONS.map(([key, label]) => {
      const value = data[key] || { configured: false, healthy: null, message: '' };
      return <article key={key} data-integration={key}><span>{label}</span><strong>{stateCopy(value)}</strong>
        <small>{value.message || (value.configured ? 'Configurarea este protejată pe server.' : 'Completează configurația în Vercel înainte de activare.')}</small></article>;
    })}</div> : null}
  </section>;
}
