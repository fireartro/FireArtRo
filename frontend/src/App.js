import { lazy, Suspense, useEffect } from "react";
import "@/App.css";
import { BrowserRouter, Navigate, Routes, Route, useLocation } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import Home from "@/pages/Home";
import CookieConsent from "@/components/site/CookieConsent";
import RouteShutter from "@/components/night/RouteShutter";
import { scrollToHash, scrollToTop, syncScrollOffset } from "@/lib/scrollNavigation";
import { ManagedContentProvider, useManagedContentSnapshot } from "@/content/ManagedContentProvider";

const GalleryPage = lazy(() => import("@/pages/GalleryPage"));
const PackagesPage = lazy(() => import("@/pages/PackagesPage"));
const FaqPage = lazy(() => import("@/pages/FaqPage"));
const ContactPage = lazy(() => import("@/pages/ContactPage"));
const LegalPage = lazy(() => import("@/pages/LegalPage"));
const AdminPage = lazy(() => import("@/pages/AdminPage"));
const BlogPage = lazy(() => import("@/pages/BlogPage"));
const BlogArticlePage = lazy(() => import("@/pages/BlogArticlePage"));

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

  return (
    <>
      {location.pathname !== "/admin" && <CookieConsent />}
      <Toaster position="top-center" richColors />
    </>
  );
}

function AppRoutes() {
  const location = useLocation();
  const content = useManagedContentSnapshot();

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
