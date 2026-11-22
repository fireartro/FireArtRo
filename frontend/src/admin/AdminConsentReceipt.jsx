import { useEffect, useRef, useState } from 'react';
import { useAdminSession } from './AdminSessionContext';

const REFERENCE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const BUCHAREST_TIME = new Intl.DateTimeFormat('ro-RO', {
  timeZone: 'Europe/Bucharest',
  dateStyle: 'medium',
  timeStyle: 'medium',
});
const METHODS = new Map([
  ['accept_all', 'Acceptă toate'],
  ['preferences', 'Salvează preferințele'],
]);
const STATES = new Map([
  ['active', 'Acord activ'],
  ['expired', 'Acord expirat'],
  ['withdrawn', 'Acord retras'],
]);

const hasTimestamp = value => typeof value === 'string' && Number.isFinite(Date.parse(value));

function ConsentTime({ value }) {
  return <>
    <time dateTime={value}>{BUCHAREST_TIME.format(new Date(value))} (ora României)</time>
    <small>{value} (UTC)</small>
  </>;
}

function ConsentEvidence({ proof }) {
  return <dl className="cms-consent-proof-result" aria-label="Dovada înregistrată">
    <div><dt>Cod de referință</dt><dd><code>{proof.id}</code></dd></div>
    <div><dt>Stare la verificare</dt><dd>{STATES.get(proof.status)}</dd></div>
    <div><dt>Versiunea informării</dt><dd>{proof.version}</dd></div>
    {proof.contentRevision && <div><dt>Revizia publicată a informării</dt><dd><code>{proof.contentRevision}</code></dd></div>}
    <div><dt>Acțiunea vizitatorului</dt><dd>{METHODS.get(proof.method)}</dd></div>
    <div><dt>Alegerea înregistrată</dt><dd>
      <span>Analiză {proof.analytics ? 'permisă' : 'refuzată'}</span>
      <span>Conținut extern {proof.marketing ? 'permis' : 'refuzat'}</span>
    </dd></div>
    <div><dt>Acord înregistrat la</dt><dd><ConsentTime value={proof.savedAt} /></dd></div>
    <div><dt>Expirarea inițială a acordului</dt><dd><ConsentTime value={proof.expiresAt} /></dd></div>
    {proof.withdrawnAt && <div><dt>Retragere înregistrată la</dt><dd><ConsentTime value={proof.withdrawnAt} /></dd></div>}
    <div><dt>Termen de păstrare al dovezii</dt><dd><ConsentTime value={proof.deleteAfter} /></dd></div>
  </dl>;
}

export default function AdminConsentReceipt() {
  const { request } = useAdminSession();
  const [reference, setReference] = useState('');
  const [view, setView] = useState({ status: 'idle' });
  const pendingRequest = useRef(null);

  useEffect(() => () => pendingRequest.current?.abort(), []);

  const changeReference = event => {
    pendingRequest.current?.abort();
    setReference(event.target.value);
    setView({ status: 'idle' });
  };

  const lookup = async event => {
    event.preventDefault();
    pendingRequest.current?.abort();
    const id = reference.trim().toLowerCase();
    if (!REFERENCE.test(id)) {
      setView({ status: 'invalid', message: 'Introdu un cod de referință valid.' });
      return;
    }

    const controller = new AbortController();
    pendingRequest.current = controller;
    setView({ status: 'loading' });
    try {
      const proof = await request(`/api/admin/consent/${id}`, { signal: controller.signal });
      if (controller.signal.aborted) return;
      if (proof?.id !== id || !Number.isInteger(proof.version) || proof.version < 1
          || typeof proof.analytics !== 'boolean' || typeof proof.marketing !== 'boolean'
          || !STATES.has(proof.status) || !METHODS.has(proof.method)
          || !hasTimestamp(proof.savedAt) || !hasTimestamp(proof.expiresAt) || !hasTimestamp(proof.deleteAfter)
          || (proof.withdrawnAt !== null && !hasTimestamp(proof.withdrawnAt))
          || (proof.contentRevision != null && typeof proof.contentRevision !== 'string')) {
        throw new Error('Invalid consent record');
      }
      setView({ status: 'result', proof });
    } catch (error) {
      if (controller.signal.aborted) return;
      setView({
        status: 'error',
        message: error?.status === 404 ? 'Nu există o dovadă disponibilă pentru această referință.'
          : 'Dovada nu a putut fi verificată momentan. Încearcă din nou.',
      });
    } finally {
      if (pendingRequest.current === controller) pendingRequest.current = null;
    }
  };

  return <section className="cms-panel cms-consent-proof" aria-labelledby="cms-consent-proof-title">
    <header className="cms-panel-heading"><div>
      <h2 id="cms-consent-proof-title">Dovada consimțământului</h2>
      <p>Verifică alegerea înregistrată pe server folosind codul de referință furnizat de vizitator.</p>
    </div></header>
    <form className="cms-consent-proof-form" onSubmit={lookup}>
      <div className="admin-field">
        <label htmlFor="admin-consent-reference">Referință de consimțământ</label>
        <input id="admin-consent-reference" name="consent-reference" value={reference} onChange={changeReference}
          autoComplete="off" autoCapitalize="none" spellCheck={false} maxLength={80}
          aria-invalid={view.status === 'invalid' || undefined}
          aria-describedby={view.status === 'invalid' ? 'admin-consent-reference-error' : undefined} />
      </div>
      <button type="submit" className="admin-button is-primary" disabled={view.status === 'loading'}>
        Verifică dovada
      </button>
    </form>
    {view.status === 'loading' && <p role="status">Se verifică referința…</p>}
    {view.message && <p className="cms-notice is-error" role="alert" id="admin-consent-reference-error">{view.message}</p>}
    <div aria-live="polite">
      {view.status === 'result' && <ConsentEvidence proof={view.proof} />}
    </div>
  </section>;
}
