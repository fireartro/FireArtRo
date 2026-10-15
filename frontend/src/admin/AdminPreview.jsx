import { lazy, Suspense, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { DraftPreviewProvider } from '@/content/ManagedContentProvider';
import { useAdminDraft } from './AdminDraftContext';

const Home = lazy(() => import('@/pages/Home'));
const GalleryPage = lazy(() => import('@/pages/GalleryPage'));
const PackagesPage = lazy(() => import('@/pages/PackagesPage'));
const FaqPage = lazy(() => import('@/pages/FaqPage'));
const ContactPage = lazy(() => import('@/pages/ContactPage'));
const BlogPage = lazy(() => import('@/pages/BlogPage'));

const pages = { '/': ['Acasă', Home], '/galerie': ['Galerie', GalleryPage], '/pachete': ['Pachete', PackagesPage],
  '/intrebari-frecvente': ['Întrebări', FaqPage], '/contact': ['Contact', ContactPage], '/blog': ['Blog', BlogPage] };
export default function AdminPreview({ open, onClose }) {
  const { draft } = useAdminDraft();
  const [path, setPath] = useState('/');
  const [viewport, setViewport] = useState('desktop');
  const dialogRef = useRef(null);
  const closeButtonRef = useRef(null);
  const onCloseRef = useRef(onClose);
  const visible = Boolean(open && draft);

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
  const Page = pages[path][1];
  return createPortal(<div ref={dialogRef} tabIndex={-1} className="cms-preview" role="dialog" aria-modal="true" aria-labelledby="cms-preview-title">
    <header><strong id="cms-preview-title">Previzualizare draft</strong><nav>{Object.entries(pages).map(([key, [label]]) => <button key={key} aria-pressed={path === key} onClick={() => setPath(key)}>{label}</button>)}</nav>
      <div><button aria-pressed={viewport === 'desktop'} onClick={() => setViewport('desktop')}>Desktop</button><button aria-pressed={viewport === 'tablet'} onClick={() => setViewport('tablet')}>Tabletă</button><button aria-pressed={viewport === 'phone'} onClick={() => setViewport('phone')}>Telefon</button><button ref={closeButtonRef} onClick={onClose}>Închide</button></div></header>
    <div className={`cms-preview-frame is-${viewport}`} inert><DraftPreviewProvider content={draft}>
      <Suspense fallback={<div className="route-loading" role="status">Se încarcă previzualizarea…</div>}><Page /></Suspense>
    </DraftPreviewProvider></div>
  </div>, document.body);
}
