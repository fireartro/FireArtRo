import { useCallback, useLayoutEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAdminDraft } from './AdminDraftContext';
import { DraftPreviewProvider } from '@/content/ManagedContentProvider';
import HomePackages from '@/components/night/HomePackages';
import HomeGallery from '@/components/night/HomeGallery';
import '@/styles/night-home.css';
import '@/styles/night-home-film.css';

const viewports={desktop:[1440,900],tablet:[834,1112],phone:[390,844]};
const documentHtml='<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body></body></html>';

function GeometryContents({doc,content,surface,target,onRatio}) {
  useLayoutEffect(()=>{
    const ownerWindow=doc.defaultView;
    if(!ownerWindow)return undefined;
    let active=true,observer,frame;
    const selector=surface === 'home-packages' ? '[data-package-category]' : '[data-gallery-slide]';
    const root=[...doc.querySelectorAll(selector)].find(node=>(surface === 'home-packages' ? node.dataset.packageCategory : node.dataset.gallerySlide) === target);
    const element=surface === 'home-packages' ? root : root?.querySelector('figure');
    if(!element)return undefined;
    const measure=()=>{
      if(!active)return;
      const rect=element.getBoundingClientRect();
      if(rect.width>0 && rect.height>0)onRatio(rect.width/rect.height);
    };
    const start=()=>{if(!active)return;frame=ownerWindow.requestAnimationFrame(measure);if(ownerWindow.ResizeObserver){observer=new ownerWindow.ResizeObserver(measure);observer.observe(element);}ownerWindow.addEventListener('resize',measure);};
    Promise.resolve(doc.fonts?.ready).then(start);
    return()=>{active=false;observer?.disconnect();ownerWindow.removeEventListener('resize',measure);if(frame)ownerWindow.cancelAnimationFrame(frame);};
  },[doc,content,surface,target,onRatio]);
  return <DraftPreviewProvider content={content}><main className="nr-home" data-design="night-runway" inert><div className="fa-home fa-film">
    {surface === 'home-packages' ? <HomePackages geometryOnly/> : <HomeGallery geometryOnly/>}
  </div></main></DraftPreviewProvider>;
}

export default function AdminFrameGeometry({surface,target,device,onRatio}) {
  const {draft}=useAdminDraft();
  const [doc,setDoc]=useState(null);
  const [width,height]=viewports[device];
  const content=useMemo(()=>({...draft,homePage:{...draft.homePage,
    packageVisuals:draft.homePage.packageVisuals?.map(item=>item.category === target && surface === 'home-packages' ? {...item,imageFrame:null} : item),
    promoSlides:draft.homePage.promoSlides.map(item=>item.id === target && surface === 'home-gallery' ? {...item,imageFrame:null} : item),
  }}),[draft,surface,target]);
  const load=useCallback(async event=>{
    const next=event.currentTarget.contentDocument;
    if(!next?.body)return;
    await Promise.all([...document.head.querySelectorAll('link[rel="stylesheet"],style')].map(original=>new Promise(resolve=>{
      const clone=original.cloneNode(true);
      if(clone.tagName === 'LINK'){clone.addEventListener('load',resolve,{once:true});clone.addEventListener('error',resolve,{once:true});}
      next.head.appendChild(clone);
      if(clone.tagName !== 'LINK')resolve();
    })));
    if(next.defaultView?.frameElement?.isConnected)setDoc(next);
  },[]);
  return <>{doc && createPortal(<GeometryContents doc={doc} content={content} surface={surface} target={target} onRatio={onRatio}/>,doc.body)}
    <iframe className="cms-frame-measure" title="Măsurarea cadrului" aria-hidden="true" tabIndex={-1} style={{width,height}} srcDoc={documentHtml} onLoad={load}/>
  </>;
}
