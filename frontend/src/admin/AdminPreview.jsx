import { useState } from 'react';
import { createPortal } from 'react-dom';
import { DraftPreviewProvider } from '@/content/ManagedContentProvider';
import Home from '@/pages/Home';
import GalleryPage from '@/pages/GalleryPage';
import PackagesPage from '@/pages/PackagesPage';
import FaqPage from '@/pages/FaqPage';
import ContactPage from '@/pages/ContactPage';
import BlogPage from '@/pages/BlogPage';
import { useAdminDraft } from './AdminDraftContext';

const pages = { '/': ['Acasă', Home], '/galerie': ['Galerie', GalleryPage], '/pachete': ['Pachete', PackagesPage],
  '/intrebari-frecvente': ['Întrebări', FaqPage], '/contact': ['Contact', ContactPage], '/blog': ['Blog', BlogPage] };
export default function AdminPreview({ open, onClose }) {
  const { draft } = useAdminDraft();
  const [path, setPath] = useState('/');
  const [viewport, setViewport] = useState('desktop');
  if (!open || !draft) return null;
  const Page = pages[path][1];
  return createPortal(<div className="cms-preview" role="dialog" aria-modal="true" aria-labelledby="cms-preview-title">
    <header><strong id="cms-preview-title">Previzualizare draft</strong><nav>{Object.entries(pages).map(([key, [label]]) => <button key={key} aria-pressed={path === key} onClick={() => setPath(key)}>{label}</button>)}</nav>
      <div><button aria-pressed={viewport === 'desktop'} onClick={() => setViewport('desktop')}>Desktop</button><button aria-pressed={viewport === 'tablet'} onClick={() => setViewport('tablet')}>Tabletă</button><button aria-pressed={viewport === 'phone'} onClick={() => setViewport('phone')}>Telefon</button><button onClick={onClose}>Închide</button></div></header>
    <div className={`cms-preview-frame is-${viewport}`} inert=""><DraftPreviewProvider content={draft}><Page /></DraftPreviewProvider></div>
  </div>, document.body);
}
