import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Menu, LogOut } from 'lucide-react';
import { ADMIN_MODULES, MODULE_ORDER } from './adminConfig';
import { useAdminSession } from './AdminSessionContext';
import { useAdminDraft } from './AdminDraftContext';
import AdminDashboard from './AdminDashboard';
import AdminContentEditor from './AdminContentEditor';
import AdminPublishDialog from './AdminPublishDialog';
import AdminPreview from './AdminPreview';
import AdminRevisions from './AdminRevisions';
import AdminBlogPanel from './AdminBlogPanel';
import AdminQuotes from './AdminQuotes';
import AdminInbox from './AdminInbox';
import AdminMediaLibrary from './AdminMediaLibrary';
import { CMS_DEFAULTS } from '@/data/cmsDefaults';

const special = new Set(['dashboard', 'revisions', 'blog', 'quotes', 'inbox', 'media']);
const groups = [
  ['Site', ['siteDetails', 'contactSettings', 'businessHours', 'socialLinks', 'navigation', 'footer']],
  ['Pagini', ['homePage', 'galleryPage', 'packagesPage', 'faqPage', 'contactPage', 'blogPage']],
  ['Conținut', ['media', 'mediaItems', 'packages', 'faqs', 'testimonials', 'partners', 'reviewSettings']],
  ['Operațiuni', ['blog', 'quotes', 'inbox', 'revisions']],
  ['Sistem', ['cookieSettings', 'legalPages']],
];
const STATUS = { loading: 'Se încarcă', dirty: 'Nesalvat', saving: 'Se salvează', saved: 'Salvat', invalid: 'Câmpuri invalide', conflict: 'Conflict', error: 'Eroare', publishing: 'Se publică', restoring: 'Se restaurează' };
export default function AdminLayout() {
  const { logout, admin } = useAdminSession();
  const draft = useAdminDraft();
  const [params, setParams] = useSearchParams();
  const [menu, setMenu] = useState(false);
  const [publish, setPublish] = useState(false);
  const [preview, setPreview] = useState(false);
  const section = params.get('sectiune') || 'dashboard';
  const choose = key => { const next = new URLSearchParams(params); next.set('sectiune', key); setParams(next); setMenu(false); };
  if (draft.status === 'uninitialized') return <main className="admin-shell cms-bootstrap"><section><p className="admin-auth-kicker">PRIMA CONFIGURARE</p><h1>Inițializează conținutul actual.</h1>
    <p>Acest pas creează prima versiune publică și primul draft din textele și materialele existente.</p><button className="admin-button is-primary" onClick={() => draft.bootstrap(CMS_DEFAULTS)}>Inițializează în siguranță</button>{draft.error && <p role="alert">{draft.error}</p>}</section></main>;
  if (!draft.draft) return <main className="admin-shell admin-auth-status" role="status"><p>{draft.error || 'Se încarcă editorul…'}</p></main>;
  const moduleKeys = new Set(MODULE_ORDER);
  return <main className="admin-shell cms-shell">
    <header className="admin-appbar"><div className="admin-appbar-brand"><button className="admin-mobile-menu" onClick={() => setMenu(value => !value)} aria-expanded={menu} aria-label="Deschide secțiunile"><Menu /></button><Link to="/">FIREARTRO</Link><span>Administrare</span></div>
      <div className="admin-appbar-actions"><span className={`cms-save-state is-${draft.status}`} aria-live="polite">{STATUS[draft.status] || draft.status}</span><button className="admin-button" onClick={() => setPreview(true)}>Previzualizează</button><button className="admin-button is-primary" disabled={draft.status !== 'saved' || !draft.changedModules.length} onClick={() => setPublish(true)}>Publică modificările</button>
      <span className="admin-session-user">{admin.username}</span><button className="admin-session-logout" onClick={logout}><LogOut /> Ieși</button></div></header>
    <div className="admin-workspace"><aside className={`admin-sidebar ${menu ? 'is-open' : ''}`}><button className={section === 'dashboard' ? 'is-active' : ''} onClick={() => choose('dashboard')}>Panou principal</button>
      {groups.map(([title, keys]) => <section key={title}><h2>{title}</h2>{keys.filter(key => special.has(key) || moduleKeys.has(key)).map(key => <button key={key} className={section === key ? 'is-active' : ''} onClick={() => choose(key)}>{special.has(key) ? { blog: 'Articole Blog', quotes: 'Cereri de ofertă', inbox: 'Mesaje', revisions: 'Istoric publicări', media: 'Încarcă media' }[key] : ADMIN_MODULES[key]?.label}</button>)}</section>)}</aside>
      <div className="cms-main">{section === 'dashboard' ? <AdminDashboard onEdit={() => choose('homePage')} onPreview={() => setPreview(true)} onPublish={() => setPublish(true)} />
        : section === 'revisions' ? <AdminRevisions /> : section === 'blog' ? <AdminBlogPanel /> : section === 'quotes' ? <AdminQuotes /> : section === 'inbox' ? <AdminInbox /> : section === 'media' ? <AdminMediaLibrary />
        : ADMIN_MODULES[section] ? <AdminContentEditor moduleKey={section} /> : <AdminDashboard onEdit={() => choose('homePage')} onPreview={() => setPreview(true)} onPublish={() => setPublish(true)} />}</div></div>
    <AdminPublishDialog open={publish} onOpenChange={setPublish} /><AdminPreview open={preview} onClose={() => setPreview(false)} />
  </main>;
}
