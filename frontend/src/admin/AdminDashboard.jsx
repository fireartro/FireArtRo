import { useAdminDraft } from './AdminDraftContext';
import {ADMIN_MODULES} from './adminConfig';

export default function AdminDashboard({ onNavigate }) {
  const draft = useAdminDraft();
  return <section className="cms-dashboard">
    <header><h1>Panou principal</h1><p>Actualizează site-ul, verifică rezultatul și publică atunci când e pregătit.</p></header>
    <section className="cms-publication-summary" aria-labelledby="publication-summary"><h2 id="publication-summary">Modificări nepublicate</h2>
      {draft.changedModules.length ? <ul>{draft.changedModules.map(key=><li key={key}><button className="admin-button" onClick={()=>onNavigate(key)}>{ADMIN_MODULES[key]?.label || key}</button></li>)}</ul> : <p>Ciorna coincide cu versiunea publicată.</p>}
      <p className="cms-publication-date">Ultima publicare: {draft.publishedAt ? new Date(draft.publishedAt).toLocaleString('ro-RO') : 'Nu există o publicare confirmată.'}</p>
    </section>
    <section className="cms-dashboard-work"><h2>Lucrează la site</h2><nav className="cms-shortcuts" aria-label="Acces rapid">{[
      ['homePage','Prima pagină','Texte, imagini de categorii și cadre promovate'],['packages','Pachete','Imagini, încadrare, opțiuni și videoclipuri'],['mediaItems','Galerie / media','Descrieri, categorii și încadrarea fotografiilor'],['partners','Parteneri','Sigle și numele colaboratorilor'],['quotes','Cereri de ofertă','Solicitările primite prin site'],['inbox','Mesaje','Corespondența cu clienții'],
    ].map(([key,label,description])=><button className="admin-button" key={key} onClick={()=>onNavigate(key)}><span><strong>{label}</strong><small>{description}</small></span></button>)}</nav></section>
  </section>;
}
