import { useState } from 'react';
import { ExternalLink, Eye, RefreshCw } from 'lucide-react';
import { getIntegrationStatus } from '@/lib/integrationsApi';
import { REVIEW_POLICY_HREF } from '@/data/legalContent';
import { useAdminDraft } from './AdminDraftContext';
import { useAdminSession } from './AdminSessionContext';
import AdminContentEditor from './AdminContentEditor';
import './admin-reviews.css';

const sources = [
  {
    id: 'facebook',
    label: 'Facebook',
    field: 'facebookEnabled',
    integration: 'Elfsight',
    description: 'Când sursa este activă, site-ul încarcă widgetul Elfsight după acordul pentru Conținut extern. Dacă widgetul nu răspunde, vizitatorii au în continuare un link spre recenziile de pe Facebook.',
  },
  {
    id: 'google',
    label: 'Google Maps',
    field: 'googleEnabled',
    integration: 'Places API',
    description: 'Site-ul afișează recenziile cu autor și link furnizate de Google Places, după acordul pentru Conținut extern. Google furnizează cel mult cinci recenzii.',
  },
];

function DisplayState({ settings, field }) {
  if (!settings) return 'Necunoscută';
  return settings.enabled && settings[field] ? 'Permisă' : 'Oprită';
}

function IntegrationState({ value }) {
  if (!value) return <p>Stare neverificată.</p>;
  let label = 'Configurat';
  if (!value.configured) label = 'Necesită configurare';
  else if (value.healthy === true) label = 'Conectat';
  else if (value.healthy === false) label = 'Eroare de conectare';
  return <div className="cms-reviews__diagnostic">
    <strong>{label}</strong>
    {value.message && <p>{value.message}</p>}
  </div>;
}

export default function AdminReviews({ onPreview }) {
  const { draft, publishedContent } = useAdminDraft();
  const { request } = useAdminSession();
  const [view, setView] = useState('site');
  const [diagnostics, setDiagnostics] = useState({ status: 'idle', data: null });
  const selectingArchive = view === 'archive';
  const checking = diagnostics.status === 'loading';
  const currentSettings = draft.reviewSettings;
  const publishedSettings = publishedContent?.reviewSettings;

  async function checkSources() {
    setDiagnostics({ status: 'loading', data: null });
    try {
      const data = await getIntegrationStatus(request, { refresh: true });
      setDiagnostics({ status: 'loaded', data });
    } catch {
      setDiagnostics({ status: 'error', data: null });
    }
  }

  return <section className="cms-panel cms-reviews" aria-labelledby="admin-reviews-title">
    <header className="cms-panel-heading">
      <div>
        <h1 id="admin-reviews-title">Recenzii</h1>
        <p>Controlează secțiunea afișată la finalul paginilor publice.</p>
      </div>
      <div className="cms-reviews__actions">
        {onPreview && <button type="button" className="admin-button is-primary" onClick={() => onPreview()}>
          <Eye aria-hidden="true" /> Previzualizează recenziile
        </button>}
        <a className="admin-button" href="/#recenzii" target="_blank" rel="noopener noreferrer">
          Vezi pe site <ExternalLink aria-hidden="true" />
        </a>
      </div>
    </header>

    <nav className="cms-page-tabs" aria-label="Pagini recenzii">
      <button type="button" aria-pressed={!selectingArchive} onClick={() => setView('site')}>Pe site</button>
      <button type="button" aria-pressed={selectingArchive} onClick={() => setView('archive')}>Arhivă manuală ({draft.testimonials.length})</button>
    </nav>

    {selectingArchive ? <div className="cms-reviews__archive">
      <p>Arhivă de testimoniale. Secțiunea publică folosește sursele externe din fila „Pe site”.</p>
      <AdminContentEditor moduleKey="testimonials" embedded />
    </div> : <>
      <section className="cms-reviews__settings" aria-labelledby="admin-review-settings">
        <h2 id="admin-review-settings">Afișare pe site</h2>
        <p>Previzualizarea folosește draftul. Paginile publice folosesc ultima versiune publicată.</p>
        <AdminContentEditor moduleKey="reviewSettings" embedded />
      </section>

      <section className="cms-reviews__sources" aria-labelledby="admin-review-sources">
        <header>
          <div>
            <h2 id="admin-review-sources">Surse și disponibilitate</h2>
            <p>Verificarea Google Places poate consuma din cota API.</p>
          </div>
          <button type="button" className="admin-button" disabled={checking} onClick={checkSources}>
            <RefreshCw aria-hidden="true" /> {checking ? 'Se verifică…' : 'Verifică Google Places'}
          </button>
        </header>
        {checking && <p role="status">Se verifică Google Places…</p>}
        {diagnostics.status === 'error' && <p className="cms-notice is-error" role="alert">Starea Google Places nu este disponibilă momentan. Poți încerca din nou.</p>}
        <div className="cms-reviews__source-grid" aria-live="polite">
          {sources.map(source => <article key={source.id} data-review-source={source.id}>
            <h3>{source.label}</h3>
            <dl className="cms-reviews__display-states">
              <div><dt>Afișare publicată</dt><dd><DisplayState settings={publishedSettings} field={source.field} /></dd></div>
              <div><dt>Afișare în draft</dt><dd><DisplayState settings={currentSettings} field={source.field} /></dd></div>
            </dl>
            <p>{source.description}</p>
            <div className="cms-reviews__api">
              <h4>{source.integration}</h4>
              {source.id === 'google' ? <IntegrationState value={diagnostics.data?.google} /> : (
                <a href="/#recenzii" target="_blank" rel="noopener noreferrer">Verifică afișarea pe site <ExternalLink aria-hidden="true" /></a>
              )}
            </div>
          </article>)}
        </div>
        <p className="cms-reviews__policy">
          <a href={REVIEW_POLICY_HREF} target="_blank" rel="noopener noreferrer">Sursă și verificare <ExternalLink aria-hidden="true" /></a>
        </p>
      </section>
    </>}
  </section>;
}
