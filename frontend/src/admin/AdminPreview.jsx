import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAdminDraft } from './AdminDraftContext';

const pages = {'/':'Acasă','/galerie':'Galerie','/pachete':'Pachete','/intrebari-frecvente':'Întrebări','/contact':'Contact','/blog':'Blog'};
const sizes = {desktop:[1440,900],tablet:[834,1112],phone:[390,844]};
export default function AdminPreview({ open, onClose }) {
  const { draft } = useAdminDraft();
  const [path, setPath] = useState('/');
  const [viewport, setViewport] = useState('desktop');
  const dialogRef = useRef(null);
  const closeButtonRef = useRef(null);
  const onCloseRef = useRef(onClose);
  const visible = Boolean(open && draft);
  const frameRef=useRef(null);
  const draftRef=useRef(draft);
  draftRef.current=draft;
  const readyRef=useRef(false);
  const [available,setAvailable]=useState(()=>window.innerWidth-32);

  useEffect(()=>{
    if(!visible) return undefined;
    readyRef.current=false;
    const receive=event=>{
      if(event.origin !== window.location.origin || event.source !== frameRef.current?.contentWindow) return;
      if(event.data?.type === 'fireart:preview-key') {
        if(event.data.key === 'Escape')onCloseRef.current();
        if(event.data.key === 'Tab') {
          const buttons=[...dialogRef.current.querySelectorAll('header button')].filter(button=>!button.disabled);
          (event.data.shiftKey ? buttons[buttons.length-1] : buttons[0])?.focus();
        }
        return;
      }
      if(event.data?.type !== 'fireart:preview-ready')return;
      readyRef.current=true;
      frameRef.current.contentWindow.postMessage({type:'fireart:preview-content',content:draftRef.current},window.location.origin);
    };
    const resize=()=>setAvailable(Math.max(200,window.innerWidth-32));
    resize();window.addEventListener('message',receive);window.addEventListener('resize',resize);
    return ()=>{window.removeEventListener('message',receive);window.removeEventListener('resize',resize);readyRef.current=false;};
  },[visible,path]);
  useEffect(()=>{
    if(visible && readyRef.current) frameRef.current?.contentWindow.postMessage({type:'fireart:preview-content',content:draft},window.location.origin);
  },[draft,visible]);

  useLayoutEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  useLayoutEffect(() => {
    if (!visible) return;
    const dialog = dialogRef.current;
    const ownerDocument = dialog.ownerDocument;
    const ownerWindow = ownerDocument.defaultView;
    const opener = ownerDocument.activeElement;
    const priorInert = new Map();
    let lastFocused = closeButtonRef.current;

    const controls = () => [...dialog.querySelectorAll('button, [href], input, select, textarea, [tabindex]')]
      .filter(control => {
        if (control.tabIndex < 0 || control.matches(':disabled') || control.closest('[inert], [hidden]')) return false;
        for (let element = control; element && element !== dialog; element = element.parentElement) {
          const style = ownerWindow.getComputedStyle(element);
          if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse') return false;
        }
        return true;
      });
    const focusInside = () => {
      const available = controls();
      const target = available.includes(lastFocused) ? lastFocused : available[0] || dialog;
      target.focus();
    };
    const handleFocus = event => {
      if (event.target === dialog || controls().includes(event.target)) {
        lastFocused = event.target;
      } else {
        focusInside();
      }
    };
    const handleKeyDown = event => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        onCloseRef.current();
      } else if (event.key === 'Tab') {
        const available = controls();
        const index = available.indexOf(ownerDocument.activeElement);
        if (index === -1 || (event.shiftKey ? index === 0 : index === available.length - 1)) {
          event.preventDefault();
          (event.shiftKey ? available[available.length - 1] || dialog : available[0] || dialog).focus();
        }
      }
    };
    const makeInert = sibling => {
      if (sibling === dialog) return;
      if (!priorInert.has(sibling)) priorInert.set(sibling, sibling.getAttribute('inert'));
      sibling.setAttribute('inert', '');
    };

    [...ownerDocument.body.children].forEach(makeInert);
    const observer = new ownerWindow.MutationObserver(records => {
      records.forEach(record => record.addedNodes.forEach(node => {
        if (node.nodeType === 1) makeInert(node);
      }));
    });
    observer.observe(ownerDocument.body, { childList: true });
    ownerDocument.addEventListener('keydown', handleKeyDown, true);
    ownerDocument.addEventListener('focusin', handleFocus, true);
    focusInside();

    return () => {
      observer.disconnect();
      ownerDocument.removeEventListener('keydown', handleKeyDown, true);
      ownerDocument.removeEventListener('focusin', handleFocus, true);
      priorInert.forEach((value, sibling) => {
        if (value === null) sibling.removeAttribute('inert');
        else sibling.setAttribute('inert', value);
      });
      if (opener?.isConnected && typeof opener.focus === 'function') opener.focus();
    };
  }, [visible]);

  if (!visible) return null;
  const [width,height]=sizes[viewport];
  const scale=Math.min(1,available/width);
  return createPortal(<div ref={dialogRef} tabIndex={-1} className="cms-preview" role="dialog" aria-modal="true" aria-labelledby="cms-preview-title">
    <header><strong id="cms-preview-title">Previzualizare draft</strong><nav>{Object.entries(pages).map(([key, label]) => <button key={key} aria-pressed={path === key} onClick={() => setPath(key)}>{label}</button>)}</nav>
      <div><button aria-pressed={viewport === 'desktop'} onClick={() => setViewport('desktop')}>Desktop</button><button aria-pressed={viewport === 'tablet'} onClick={() => setViewport('tablet')}>Tabletă</button><button aria-pressed={viewport === 'phone'} onClick={() => setViewport('phone')}>Telefon</button><button ref={closeButtonRef} onClick={onClose}>Închide</button></div></header>
    <p className="cms-preview-dimensions">{width} × {height} px · previzualizare a draftului curent</p>
    <div className={`cms-preview-frame is-${viewport}`} style={{width:width*scale,height:height*scale,minHeight:0}}>
      <iframe key={path} ref={frameRef} title="Previzualizare site" aria-description="Previzualizare doar pentru citire. Folosește Page Down pentru derulare și Escape pentru închidere." tabIndex={0} src={`/admin?previzualizare=1&pagina=${encodeURIComponent(path)}`} style={{width,height,transform:`scale(${scale})`,transformOrigin:'top left'}}/>
    </div>
  </div>, document.body);
}
