import { lazy, Suspense, useEffect } from "react";
import "@/App.css";
// These shared styles already ship on every public route; keep their cascade
// stable when pages and Admin previews load in different orders.
import "@/styles/night-reviews.css";
import "@/styles/night-blog.css";
import { BrowserRouter, Navigate, Routes, Route, useLocation } from "react-router-dom";
import CookieConsent from "@/components/site/CookieConsent";
import AnalyticsLoader from "@/components/site/AnalyticsLoader";
import RouteShutter from "@/components/night/RouteShutter";
import { scrollToHash, scrollToTop, syncScrollOffset } from "@/lib/scrollNavigation";
import { ManagedContentProvider, useManagedContentSnapshot } from "@/content/ManagedContentProvider";

const loadHome = () => import("@/pages/Home");
const loadGallery = () => import("@/pages/GalleryPage");
const loadPackages = () => import("@/pages/PackagesPage");
const loadFaq = () => import("@/pages/FaqPage");
const loadContact = () => import("@/pages/ContactPage");
const loadLegal = () => import("@/pages/LegalPage");
const loadBlog = () => import("@/pages/BlogPage");
const loadArticle = () => import("@/pages/BlogArticlePage");
const Home = lazy(loadHome);
const GalleryPage = lazy(loadGallery);
const PackagesPage = lazy(loadPackages);
const FaqPage = lazy(loadFaq);
const ContactPage = lazy(loadContact);
const LegalPage = lazy(loadLegal);
const AdminPage = lazy(() => import("@/pages/AdminPage"));
const BlogPage = lazy(loadBlog);
const BlogArticlePage = lazy(loadArticle);
const publicRouteLoaders = {
  '/': loadHome, '/galerie': loadGallery, '/pachete': loadPackages,
  '/intrebari-frecvente': loadFaq, '/contact': loadContact, '/blog': loadBlog,
  '/confidentialitate': loadLegal, '/termeni-si-conditii': loadLegal, '/cookies': loadLegal,
};

function RouteScrollManager() {
  const location = useLocation();

  useEffect(() => {
    syncScrollOffset();
    const timer = window.setTimeout(() => {
      if (location.hash) scrollToHash(location.hash, "auto");
      else scrollToTop("auto");
    }, 90);
    return () => window.clearTimeout(timer);
  }, [location.pathname, location.hash]);

  return null;
}

function GlobalUi() {
  const location = useLocation();

  return location.pathname !== "/admin" ? <>
    <AnalyticsLoader />
    <CookieConsent />
  </> : null;
}

function AppRoutes() {
  const location = useLocation();
  const content = useManagedContentSnapshot();

  useEffect(() => {
    // Fetch only the requested public page in parallel with the CMS snapshot.
    // Interior routes never download homepage scenes or Admin code.
    const path = location.pathname.replace(/\/$/, '') || '/';
    const loadPage = publicRouteLoaders[path] || (path.startsWith('/blog/') ? loadArticle : null);
    loadPage?.().catch(() => {});
  }, [location.pathname]);

  if (location.pathname !== "/admin" && !["ready", "fallback"].includes(content.status)) {
    return <main className="route-loading" role="status" aria-live="polite">
      {content.status === "unavailable" ? "Site-ul este în curs de inițializare. Revino în câteva momente." : "Se încarcă versiunea publicată…"}
    </main>;
  }

  return (
    <div className="route-stage">
      <Suspense fallback={<div className="route-loading" role="status" aria-label="Se încarcă pagina" />}>
        <Routes location={location}>
          <Route path="/" element={<Home />} />
          <Route path="/galerie" element={<GalleryPage />} />
          <Route path="/pachete" element={<PackagesPage />} />
          <Route path="/intrebari-frecvente" element={<FaqPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/blog" element={<BlogPage />} />
          <Route path="/blog/:slug" element={<BlogArticlePage />} />
          <Route path="/confidentialitate" element={<LegalPage type="confidentialitate" />} />
          <Route path="/termeni-si-conditii" element={<LegalPage type="termeni" />} />
          <Route path="/cookies" element={<LegalPage type="cookies" />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/legal/confidentialitate" element={<Navigate to="/confidentialitate" replace />} />
          <Route path="/legal/termeni" element={<Navigate to="/termeni-si-conditii" replace />} />
          <Route path="/legal/cookies" element={<Navigate to="/cookies" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </div>
  );
}

function App() {
  useEffect(() => {
    let stableWidth = window.innerWidth;

    const setViewportUnit = () => {
      document.documentElement.style.setProperty("--stable-vh", `${window.innerHeight * 0.01}px`);
      stableWidth = window.innerWidth;
    };

    const onResize = () => {
      if (Math.abs(window.innerWidth - stableWidth) > 2) setViewportUnit();
    };

    setViewportUnit();
    window.addEventListener("orientationchange", setViewportUnit);
    window.addEventListener("resize", onResize, { passive: true });
    return () => {
      window.removeEventListener("orientationchange", setViewportUnit);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return (
    <div className="App">
      <BrowserRouter>
        <ManagedContentProvider>
        <RouteShutter>
          <a className="skip-link" href="#main-content">Sari la conținut</a>
          <RouteScrollManager />
          <div id="main-content" tabIndex="-1">
            <AppRoutes />
          </div>
          <GlobalUi />
        </RouteShutter>
        </ManagedContentProvider>
      </BrowserRouter>
    </div>
  );
}

export default App;
