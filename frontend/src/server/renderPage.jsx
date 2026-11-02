import { Suspense } from 'react';
import { renderToString } from 'react-dom/server';
import { Routes, Route, StaticRouter } from 'react-router-dom';
import { PublishedContentSnapshotProvider } from '@/content/ManagedContentProvider';
import { PublicRenderDataProvider } from '@/content/PublicRenderData';
import { normalizePublishedContent } from '@/content/managedContentSchema';
import { PageMetadataContext } from '@/hooks/usePageMeta';
import Home from '@/pages/Home';
import PackagesPage from '@/pages/PackagesPage';
import GalleryPage from '@/pages/GalleryPage';
import FaqPage from '@/pages/FaqPage';
import ContactPage from '@/pages/ContactPage';
import BlogPage from '@/pages/BlogPage';
import BlogArticlePage from '@/pages/BlogArticlePage';
import LegalPage from '@/pages/LegalPage';
import ServicePage from '@/pages/ServicePage';
import { SERVICE_CATALOG } from '@/data/serviceCatalog';
import RouteShutter from '@/components/night/RouteShutter';

const EffectOnlyRouteReady = () => null;

const fixed = {
  '/': Home, '/pachete': PackagesPage, '/galerie': GalleryPage,
  '/intrebari-frecvente': FaqPage, '/contact': ContactPage, '/blog': BlogPage,
  '/confidentialitate': () => <LegalPage type="confidentialitate" />,
  '/termeni-si-conditii': () => <LegalPage type="termeni" />,
  '/cookies': () => <LegalPage type="cookies" />,
  ...Object.fromEntries(SERVICE_CATALOG.map(service => [service.path, () => <ServicePage service={service} />])),
};

export function publicPageForPath(value) {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || /[\\\u0000-\u001f]/.test(value)) return null;
  const pathname = value.split(/[?#]/)[0].replace(/\/$/, '') || '/';
  if (fixed[pathname]) return {pathname, Component: fixed[pathname], pattern: pathname};
  if (/^\/blog\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(pathname)) return {pathname, Component: BlogArticlePage, pattern: '/blog/:slug'};
  return null;
}

export function renderPublicPage(url, rawData) {
  const route = publicPageForPath(url);
  if (!route) throw new Error('Public page not found');
  const publication = rawData?.publication;
  if (!publication?.revision_id || !Number.isFinite(Date.parse(publication.published_at))) throw new Error('Publication unavailable');
  const data = {
    pathname: route.pathname,
    publication: {revision_id: publication.revision_id, published_at: publication.published_at, content: normalizePublishedContent(publication.content)},
    posts: rawData.posts || [], post: rawData.post || null,
  };
  const metadata = {current: null};
  const html = renderToString(
    <StaticRouter location={url}>
      <PublicRenderDataProvider value={data}>
        <PublishedContentSnapshotProvider content={data.publication.content} revisionId={publication.revision_id}>
          <PageMetadataContext.Provider value={metadata}>
            <div className="App"><RouteShutter><a className="skip-link" href="#main-content">Sari la conținut</a>
              <EffectOnlyRouteReady />
              <div id="main-content" tabIndex="-1"><div className="route-stage">
                <Suspense fallback={null}>
                  <EffectOnlyRouteReady />
                  <Routes><Route path={route.pattern} element={<route.Component />} /></Routes>
                </Suspense>
              </div></div>
              <EffectOnlyRouteReady />
            </RouteShutter></div>
          </PageMetadataContext.Provider>
        </PublishedContentSnapshotProvider>
      </PublicRenderDataProvider>
    </StaticRouter>,
  );
  if (!metadata.current || !html.includes('<h1')) throw new Error('Public page unavailable');
  return {html, meta: metadata.current, data, pathname: route.pathname};
}
