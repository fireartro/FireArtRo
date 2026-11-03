import { lazy, Suspense, useEffect, useState } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { DraftPreviewProvider } from '@/content/ManagedContentProvider';
import { normalizePublishedContent } from '@/content/managedContentSchema';
import AdminGate from './AdminGate';
import { AdminSessionProvider } from './AdminSessionContext';
import '@/admin.css';

const pages={
  '/':lazy(()=>import('@/pages/Home')),
  '/galerie':lazy(()=>import('@/pages/GalleryPage')),
  '/pachete':lazy(()=>import('@/pages/PackagesPage')),
  '/intrebari-frecvente':lazy(()=>import('@/pages/FaqPage')),
  '/contact':lazy(()=>import('@/pages/ContactPage')),
  '/blog':lazy(()=>import('@/pages/BlogPage')),
};

function PreviewDocument({path}) {
  const [content,setContent]=useState(null);
  const [error,setError]=useState('');
  useEffect(()=>{
    window.__fireartIntro?.dismiss();
    const receive=event=>{
      if(window.parent === window || event.source !== window.parent || event.origin !== window.location.origin || event.data?.type !== 'fireart:preview-content') return;
      try {setContent(normalizePublishedContent(event.data.content));setError('');}
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
  },[]);
  if(error) return <p role="alert" style={{padding:24,color:'#fff'}}>{error}</p>;
  if(!content) return <p role="status" style={{padding:24,color:'#fff'}}>Se pregătește previzualizarea…</p>;
  const Page=pages[path];
  return <DraftPreviewProvider content={content}><div inert>
    <Suspense fallback={<p role="status">Se încarcă pagina…</p>}><Page/></Suspense>
  </div></DraftPreviewProvider>;
}

export default function AdminPreviewCanvas() {
  const requested=new URLSearchParams(window.location.search).get('pagina');
  const path=Object.hasOwn(pages,requested) ? requested : '/';
  return <MemoryRouter initialEntries={[path]}><AdminSessionProvider><AdminGate><PreviewDocument path={path}/></AdminGate></AdminSessionProvider></MemoryRouter>;
}
