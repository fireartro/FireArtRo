import { useEffect, useRef } from "react";
import { RefreshCw } from "lucide-react";
import AdminLogin from "./AdminLogin";
import { useAdminSession } from "./AdminSessionContext";

function useAdminNoIndex(status) {
  const initialDocumentState = useRef(null);

  useEffect(() => {
    const selector = 'meta[name="robots"]';
    let robots = document.head.querySelector(selector);

    if (!initialDocumentState.current) {
      initialDocumentState.current = {
        title: document.title,
        hadRobots: Boolean(robots),
        robotsContent: robots?.getAttribute("content") || "",
      };
    }

    if (!robots) {
      robots = document.createElement("meta");
      robots.setAttribute("name", "robots");
      document.head.appendChild(robots);
    }
    if (status !== "authenticated") {
      document.title = "Administrare | FireArtRo";
    }
    robots.setAttribute("content", "noindex, nofollow");
  }, [status]);

  useEffect(() => {
    return () => {
      const saved = initialDocumentState.current;
      if (!saved) return;

      document.title = saved.title;
      const robots = document.head.querySelector('meta[name="robots"]');
      if (saved.hadRobots) {
        if (robots) robots.setAttribute("content", saved.robotsContent);
      } else {
        robots?.remove();
      }
    };
  }, []);
}

function AdminLoading() {
  return (
    <main className="admin-auth-shell admin-auth-status" role="status" aria-live="polite">
      <div className="admin-auth-orbit" aria-hidden="true" />
      <p>Verificăm sesiunea de administrare…</p>
    </main>
  );
}

function AdminUnavailable() {
  const { refresh } = useAdminSession();
  return (
    <main className="admin-auth-shell admin-auth-status" aria-labelledby="admin-unavailable-title">
      <div className="admin-auth-orbit" aria-hidden="true" />
      <section className="admin-auth-status-card">
        <p className="admin-auth-kicker">ADMIN FIREARTRO</p>
        <h1 id="admin-unavailable-title">Administrarea nu este disponibilă momentan.</h1>
        <p>Verifică setările de conectare ale mediului înainte de a încerca din nou.</p>
        <button type="button" onClick={() => refresh()}><RefreshCw aria-hidden="true" /> Încearcă din nou</button>
      </section>
    </main>
  );
}

export function AdminGate({ children }) {
  const { status } = useAdminSession();
  useAdminNoIndex(status);

  if (status === "checking") return <AdminLoading />;
  if (status === "unavailable") return <AdminUnavailable />;
  if (status !== "authenticated") return <AdminLogin />;
  return children;
}

export default AdminGate;
