import { useAdminDraft } from './AdminDraftContext';
import {ADMIN_MODULES} from './adminConfig';

export default function AdminDashboard({ onNavigate }) {
  const draft = useAdminDraft();
  return <section className="cms-dashboard">
    <header><h1>Administrare</h1><p>Editează în ciornă. Publică după verificare.</p></header>
    <section className="cms-publication-summary" aria-labelledby="publication-summary"><h2 id="publication-summary">Modificări nepublicate</h2>
      {draft.changedModules.length ? <ul>{draft.changedModules.map(key=><li key={key}><button className="admin-button" onClick={()=>onNavigate(key)}>{ADMIN_MODULES[key]?.label || key}</button></li>)}</ul> : <p>Ciorna coincide cu versiunea publicată.</p>}
      <p className="cms-publication-date">Ultima publicare: {draft.publishedAt ? new Date(draft.publishedAt).toLocaleString('ro-RO') : 'Nu există o publicare confirmată.'}</p>
    </section>
    <nav className="cms-shortcuts" aria-label="Acces rapid">{[['homePage','Prima pagină'],['partners','Parteneri'],['packages','Pachete'],['quotes','Cereri de ofertă']].map(([key,label])=><button className="admin-button" key={key} onClick={()=>onNavigate(key)}>{label}<span aria-hidden="true">↗</span></button>)}</nav>
  </section>;
}
