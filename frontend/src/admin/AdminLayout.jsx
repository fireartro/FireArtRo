import { useEffect, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
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
import AdminIntegrations from './AdminIntegrations';
import AdminMigrationPanel from './AdminMigrationPanel';
import AdminFeedback from './AdminFeedback';
import { CMS_DEFAULTS } from '@/data/cmsDefaults';

const special = new Set(['dashboard', 'revisions', 'blog', 'quotes', 'inbox', 'media', 'integrations']);
const groups = [
  ['Pagini', ['homePage', 'galleryPage', 'packagesPage', 'faqPage', 'contactPage', 'blogPage']],
  ['Conținut', ['media', 'mediaItems', 'packages', 'faqs', 'partners', 'blog', 'testimonials']],
  ['Solicitări', ['quotes', 'inbox']],
  ['Setări', ['siteDetails', 'contactSettings', 'businessHours', 'socialLinks', 'navigation', 'footer', 'reviewSettings', 'cookieSettings', 'legalPages', 'integrations', 'revisions']],
];
const labels = {blog:'Articole Blog',quotes:'Cereri de ofertă',inbox:'Mesaje',revisions:'Istoric publicări',media:'Biblioteca media',integrations:'Integrări'};
function Navigation({section, choose}) {
  return <nav aria-label="Secțiuni administrare"><button className={section === 'dashboard' ? 'is-active' : ''} aria-current={section === 'dashboard' ? 'page' : undefined} onClick={() => choose('dashboard')}>Panou principal</button>
    {groups.map(([title, keys]) => <details key={title} open={keys.includes(section) || section === 'dashboard'}><summary>{title}</summary>
      {keys.filter(key => special.has(key) || MODULE_ORDER.includes(key)).map(key => <button key={key} className={section === key ? 'is-active' : ''} aria-current={section === key ? 'page' : undefined} onClick={() => choose(key)}>{labels[key] || ADMIN_MODULES[key]?.label}</button>)}
    </details>)}
  </nav>;
}
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
  useEffect(() => {
    const wide = window.matchMedia('(min-width: 901px)');
    const closeOnDesktop = () => { if (wide.matches) setMenu(false); };
    wide.addEventListener('change', closeOnDesktop);
    return () => wide.removeEventListener('change', closeOnDesktop);
  }, []);
  if (draft.status === 'uninitialized') return <main className="admin-shell cms-bootstrap"><section><p className="admin-auth-kicker">PRIMA CONFIGURARE</p><h1>Inițializează conținutul actual.</h1>
    <p>Acest pas creează prima versiune publică și primul draft din textele și materialele existente.</p><button className="admin-button is-primary" onClick={() => draft.bootstrap(CMS_DEFAULTS)}>Inițializează în siguranță</button>{draft.error && <p role="alert">{draft.error}</p>}</section></main>;
  if (!draft.draft) return <main className="admin-shell admin-auth-status"><p role={draft.error ? 'alert' : 'status'}>{draft.error || 'Se încarcă editorul…'}</p>{draft.error && <button className="admin-button" onClick={draft.retry}>Încearcă din nou</button>}</main>;
  return <main className="admin-shell cms-shell">
    <header className="admin-appbar"><div className="admin-appbar-brand"><Dialog.Root open={menu} onOpenChange={setMenu}><Dialog.Trigger className="admin-mobile-menu" aria-label="Deschide secțiunile"><Menu /></Dialog.Trigger>
      <Dialog.Portal><Dialog.Overlay className="cms-dialog-overlay" /><Dialog.Content className="admin-mobile-navigation admin-shell" aria-describedby={undefined}><Dialog.Title>Secțiuni administrare</Dialog.Title><Navigation section={section} choose={choose}/><Dialog.Close className="admin-button" aria-label="Închide secțiunile">Închide</Dialog.Close></Dialog.Content></Dialog.Portal>
    </Dialog.Root><Link to="/">FIREARTRO</Link><span>Administrare</span></div>
      <div className="admin-appbar-actions"><span className={`cms-save-state is-${draft.status}`} aria-live="polite">{STATUS[draft.status] || draft.status}</span><button className="admin-button" onClick={() => setPreview(true)}>Previzualizează</button><button className="admin-button is-primary" disabled={draft.status !== 'saved' || !draft.changedModules.length} onClick={() => setPublish(true)}>Publică modificările</button>
      <span className="admin-session-user">{admin?.username}</span><button className="admin-session-logout" onClick={logout}><LogOut /> Ieși</button></div></header>
    <div className="admin-workspace"><aside className="admin-sidebar"><Navigation section={section} choose={choose}/></aside>
      <div className="cms-main"><AdminFeedback onNavigate={choose}/>{section === 'dashboard' ? <AdminDashboard onNavigate={choose} />
        : section === 'revisions' ? <AdminRevisions /> : section === 'blog' ? <AdminBlogPanel /> : section === 'quotes' ? <AdminQuotes /> : section === 'inbox' ? <AdminInbox /> : section === 'media' ? <AdminMediaLibrary />
        : section === 'integrations' ? <><AdminIntegrations/><AdminMigrationPanel/></>
        : ADMIN_MODULES[section] ? <AdminContentEditor key={section} moduleKey={section} /> : <AdminDashboard onNavigate={choose} />}</div></div>
    <AdminPublishDialog open={publish} onOpenChange={setPublish} /><AdminPreview open={preview} onClose={() => setPreview(false)} />
  </main>;
}
