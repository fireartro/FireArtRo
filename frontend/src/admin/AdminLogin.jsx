import { useState } from "react";
import { ArrowUpRight, KeyRound, ShieldCheck } from "lucide-react";
import { useAdminSession } from "./AdminSessionContext";

export default function AdminLogin() {
  const { login, status } = useAdminSession();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const isSubmitting = status === "authenticating";

  const submit = async (event) => {
    event.preventDefault();
    setMessage("");
    try {
      await login({ username, password });
    } catch {
      setPassword("");
      setMessage("Datele de autentificare nu sunt valide.");
    }
  };

  return (
    <main className="admin-auth-shell">
      <div className="admin-auth-orbit" aria-hidden="true" />
      <section className="admin-auth-frame" aria-labelledby="admin-login-title">
        <header className="admin-auth-header">
          <a href="/" className="admin-auth-brand" aria-label="FireArtRo, pagina principală">FireArtRo</a>
          <span><ShieldCheck aria-hidden="true" /> acces protejat</span>
        </header>
        <div className="admin-auth-content">
          <p className="admin-auth-kicker">ADMIN FIREARTRO</p>
          <h1 id="admin-login-title">Conținutul rămâne la tine în control.</h1>
          <p className="admin-auth-copy">Intră pentru a pregăti o ciornă, a verifica schimbările și a publica doar când ești gata.</p>

          <form className="admin-auth-form" onSubmit={submit} noValidate>
            <label>
              <span>Utilizator</span>
              <input
                name="username"
                type="text"
                autoComplete="username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                required
              />
            </label>
            <label>
              <span>Parolă</span>
              <input
                name="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </label>
            {message && <p className="admin-auth-error" role="alert">{message}</p>}
            <button type="submit" disabled={isSubmitting}>
              <KeyRound aria-hidden="true" />
              {isSubmitting ? "Se verifică…" : "Intră în Admin"}
              <ArrowUpRight aria-hidden="true" />
            </button>
          </form>
        </div>
        <p className="admin-auth-footnote">Sesiunea este protejată și nu păstrează parola în browser.</p>
      </section>
    </main>
  );
}
