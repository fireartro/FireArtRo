import { lazy, Suspense, useEffect, useState } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { DraftPreviewProvider } from '@/content/ManagedContentProvider';
import { normalizePublishedContent } from '@/content/managedContentSchema';
import { SERVICE_CATALOG } from '@/data/serviceCatalog';
import { scrollToHash } from '@/lib/scrollNavigation';
import { ADMIN_PREVIEW_ROUTES, ARTICLE_PREVIEW_PATH } from './adminPreviewRoutes';
import AdminGate from './AdminGate';
import { AdminSessionProvider } from './AdminSessionContext';
import '@/admin.css';

const LegalPage = lazy(() => import('@/pages/LegalPage'));
const ServicePage = lazy(() => import('@/pages/ServicePage'));
const BlogArticlePage = lazy(() => import('@/pages/BlogArticlePage'));
const articleFields = ['title', 'excerpt', 'body', 'category', 'cover_media_id', 'cover_alt', 'published_at'];

const pages={
  '/':lazy(()=>import('@/pages/Home')),
  '/galerie':lazy(()=>import('@/pages/GalleryPage')),
  '/pachete':lazy(()=>import('@/pages/PackagesPage')),
  '/intrebari-frecvente':lazy(()=>import('@/pages/FaqPage')),
  '/contact':lazy(()=>import('@/pages/ContactPage')),
  '/blog':lazy(()=>import('@/pages/BlogPage')),
  '/confidentialitate': () => <LegalPage type="confidentialitate" />,
  '/termeni-si-conditii': () => <LegalPage type="termeni" />,
  '/cookies': () => <LegalPage type="cookies" />,
  ...Object.fromEntries(SERVICE_CATALOG.map(service => [service.path, () => <ServicePage service={service} />])),
};

function ScrollToSection({ anchor }) {
  useEffect(() => { if (anchor) scrollToHash(anchor, 'instant'); }, [anchor]);
  return null;
}

function PreviewDocument({path, anchor}) {
  const [snapshot, setSnapshot] = useState(null);
  const [error,setError]=useState('');
  useEffect(()=>{
    window.__fireartIntro?.dismiss();
    const receive=event=>{
      if(window.parent === window || event.source !== window.parent || event.origin !== window.location.origin || event.data?.type !== 'fireart:preview-content') return;
      try {
        const content = normalizePublishedContent(event.data.content);
        const article = path === ARTICLE_PREVIEW_PATH && event.data.article
          ? Object.fromEntries(articleFields.map(key => [
            key, typeof event.data.article[key] === 'string' ? event.data.article[key] : '',
          ]))
          : null;
        setSnapshot({ content, article });
        setError('');
      }
      catch {setError('Draftul nu poate fi previzualizat. Corectează câmpurile semnalate în editor.');}
    };
    document.body.tabIndex=0;
    const keyboard=event=>{
      if(window.parent === window)return;
      // The public page is inert, so explicitly scroll its read-only canvas.
      const steps={PageDown:innerHeight*.85,PageUp:-innerHeight*.85,ArrowDown:64,ArrowUp:-64,Home:-document.documentElement.scrollHeight,End:document.documentElement.scrollHeight};
      if(Object.hasOwn(steps,event.key)){event.preventDefault();window.scrollBy({top:steps[event.key],behavior:'instant'});return;}
      if(!['Tab','Escape'].includes(event.key))return;
      event.preventDefault();
      window.parent.postMessage({type:'fireart:preview-key',key:event.key,shiftKey:event.shiftKey},window.location.origin);
    };
    window.addEventListener('message',receive);
    window.addEventListener('keydown',keyboard);
    if(window.parent !== window) window.parent.postMessage({type:'fireart:preview-ready'},window.location.origin);
    return ()=>{window.removeEventListener('message',receive);window.removeEventListener('keydown',keyboard);document.body.removeAttribute('tabindex');};
  },[path]);
  if(error) return <p role="alert" style={{padding:24,color:'#fff'}}>{error}</p>;
  if(!snapshot) return <p role="status" style={{padding:24,color:'#fff'}}>Se pregătește previzualizarea…</p>;
  const Page=pages[path];
  return <DraftPreviewProvider content={snapshot.content}><div inert>
    <Suspense fallback={<p role="status">Se încarcă pagina…</p>}>
      {Page ? <Page /> : snapshot.article ? <Routes>
        <Route path="/blog/:slug" element={<BlogArticlePage previewPost={snapshot.article} />} />
      </Routes> : <p role="status">Deschide articolul din editor pentru a-l previzualiza.</p>}
      <ScrollToSection anchor={anchor} />
    </Suspense>
  </div></DraftPreviewProvider>;
}

export default function AdminPreviewCanvas() {
  const params = new URLSearchParams(window.location.search);
  const requested = params.get('pagina');
  const path = Object.hasOwn(ADMIN_PREVIEW_ROUTES, requested) || requested === ARTICLE_PREVIEW_PATH ? requested : '/';
  const requestedAnchor = params.get('ancora');
  const anchor = ['#parteneri', '#recenzii'].includes(requestedAnchor) ? requestedAnchor : null;
  return <MemoryRouter initialEntries={[path]}><AdminSessionProvider><AdminGate><PreviewDocument path={path} anchor={anchor} /></AdminGate></AdminSessionProvider></MemoryRouter>;
}
