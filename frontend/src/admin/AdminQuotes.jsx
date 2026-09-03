import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAdminSession } from "./AdminSessionContext";
import { getAdminQuote, listAdminQuotes, QUOTE_STATUSES, quoteFilters, updateAdminQuote } from "../lib/quotesApi";

const wrap = { minWidth: 0, overflowWrap: "anywhere" };
const rowStyle = { display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" };
const nameOf = (quote) => `${quote.first_name} ${quote.last_name}`;
function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("ro-RO");
}
function StatusOptions() {
  return Object.entries(QUOTE_STATUSES).map(([value, label]) => <option key={value} value={value}>{label}</option>);
}

function QuoteEditor({ quote, request, onSaved, onReload, onBlocked }) {
  const [confirmed, setConfirmed] = useState(quote);
  const [values, setValues] = useState({ status: quote.status, internal_note: quote.internal_note });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [conflict, setConflict] = useState(false);
  const mounted = useRef(false);
  const writing = useRef(false);
  const dirty = values.status !== confirmed.status || values.internal_note !== confirmed.internal_note;
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => { onBlocked(dirty || saving); return () => onBlocked(false); }, [dirty, saving, onBlocked]);
  useEffect(() => {
    if (!dirty && !saving) return undefined;
    const warn = (event) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, saving]);

  async function save(event) {
    event.preventDefault();
    if (writing.current || !dirty || conflict) return;
    writing.current = true;
    setSaving(true); setError(""); setMessage("");
    try {
      const saved = await updateAdminQuote(request, confirmed, values);
      if (!mounted.current) return;
      // A malformed response must never be announced as a confirmed save.
      if (saved?.id !== confirmed.id || !Number.isInteger(saved.version) || saved.version <= confirmed.version
          || saved.status !== values.status || saved.internal_note !== values.internal_note) throw new Error("Invalid save acknowledgement");
      setConfirmed(saved);
      setValues({ status: saved.status, internal_note: saved.internal_note });
      setMessage("Modificările au fost salvate.");
      onSaved();
    } catch (failure) {
      if (!mounted.current) return;
      setConflict(failure.status === 409);
      setError(failure.status === 409
        ? "Cererea are o versiune mai nouă. Nota locală este păstrată; reîncarcă pentru a continua."
        : "Salvarea nu a fost confirmată. Modificările locale sunt păstrate.");
    } finally {
      writing.current = false;
      if (mounted.current) setSaving(false);
    }
  }
  const edit = (key, value) => { setValues((current) => ({ ...current, [key]: value })); setMessage(""); };
  const reload = () => {
    if (!dirty || window.confirm(`Reîncarcă cererea ${nameOf(quote)}? Modificările locale nesalvate vor fi pierdute.`)) onReload();
  };
  const phone = /^\+?[\d\s().-]{7,30}$/.test(quote.phone) ? quote.phone.replace(/[^+\d]/g, "") : "";
  const email = /^[^\s@?&#%]+@[^\s@?&#%]+\.[^\s@?&#%]+$/.test(quote.email) ? quote.email : "";

  return <form className="admin-blog-form" aria-label="Editează cererea" onSubmit={save} style={{ ...wrap, padding: 20 }}>
    <h2 style={wrap}>{nameOf(quote)}</h2>
    <p>Primită: {formatDate(quote.created_at)}</p>
    <div style={rowStyle}>
      {phone ? <a href={`tel:${phone}`}>Sună: {quote.phone}</a> : <span>{quote.phone}</span>}
      {email ? <a href={`mailto:${encodeURIComponent(email)}`}>Email: {quote.email}</a> : <span>{quote.email}</span>}
    </div>
    <dl>
      {[["Eveniment", `${quote.event_type} · ${quote.event_date}`], ["Localitate", quote.locality], ["Locație", quote.event_location],
        ["Pachet", quote.package_title || "Neselectat"], ["Servicii", quote.services.join(", ")]].map(([label, value]) =>
        <div key={label}><dt>{label}</dt><dd style={{ margin: "0 0 12px", ...wrap }}>{value || "—"}</dd></div>)}
    </dl>
    <p style={{ whiteSpace: "pre-wrap", ...wrap }}>{quote.message || "Fără mesaj suplimentar."}</p>
    <fieldset disabled={saving} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
      <legend className="admin-visually-hidden">Gestionarea cererii</legend>
      <div className="admin-field">
        <label htmlFor="quote-status">Status cerere</label>
        <select id="quote-status" name="quote-status" value={values.status} onChange={(event) => edit("status", event.target.value)}><StatusOptions /></select>
      </div>
      <div className="admin-field" style={{ marginBlock: 16 }}>
        <label htmlFor="quote-note">Notă privată</label>
        <p id="quote-note-help">Vizibilă doar în Admin. Nu se trimite clientului.</p>
        <textarea id="quote-note" name="internal-note" rows={6} maxLength={4000} aria-describedby="quote-note-help"
          value={values.internal_note} onChange={(event) => edit("internal_note", event.target.value)} />
        <small>{values.internal_note.length}/4000 caractere</small>
      </div>
      <div style={rowStyle}>
        <button className="admin-button is-primary" type="submit" disabled={!dirty || conflict}>Salvează cererea</button>
        <button className="admin-button" type="button" disabled={!dirty || conflict} onClick={() => {
          setValues({ status: confirmed.status, internal_note: confirmed.internal_note }); setError(""); setMessage("");
        }}>Anulează modificările</button>
        {(conflict || error) && <button className="admin-button" type="button" onClick={reload}>Reîncarcă cererea</button>}
      </div>
    </fieldset>
    <p role="status">{saving ? "Se salvează…" : message || (dirty ? "Modificări nesalvate" : "")}</p>
    {error && <p role="alert">{error}</p>}
  </form>;
}

function QuoteDetail({ id, request, onSaved, onBlocked }) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState({ quote: null, error: "" });
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    setState({ quote: null, error: "" });
    getAdminQuote(request, id, { signal: controller.signal }).then((quote) => {
      if (active) setState({ quote, error: "" });
    }, (error) => {
      if (active) setState({ quote: null, error: error.status === 404 ? "Cererea nu a fost găsită." : "Cererea nu poate fi încărcată momentan." });
    });
    return () => { active = false; controller.abort(); };
  }, [id, request, attempt]);
  if (state.error) return <div role="alert">{state.error} <button className="admin-button" onClick={() => setAttempt((value) => value + 1)}>Reîncarcă cererea</button></div>;
  if (!state.quote) return <p role="status">Se încarcă cererea…</p>;
  return <QuoteEditor key={`${id}:${attempt}`} quote={state.quote} request={request} onSaved={onSaved}
    onBlocked={onBlocked} onReload={() => setAttempt((value) => value + 1)} />;
}

export default function AdminQuotes() {
  const { request, status: sessionStatus } = useAdminSession();
  const [params, setParams] = useSearchParams();
  const { q, status, page } = quoteFilters(params);
  const [search, setSearch] = useState(q);
  const [filter, setFilter] = useState(status);
  const [selected, setSelected] = useState(null);
  const [blocked, setBlocked] = useState(false);
  const [revision, setRevision] = useState(0);
  const [list, setList] = useState({ items: [], total: 0, loading: true, error: "" });
  const refresh = useCallback(() => setRevision((value) => value + 1), []);
  useEffect(() => { setSearch(q); setFilter(status); setSelected(null); }, [q, status, page]);
  useEffect(() => {
    if (sessionStatus !== "authenticated") return undefined;
    let active = true;
    const controller = new AbortController();
    setList({ items: [], total: 0, loading: true, error: "" });
    listAdminQuotes(request, { q, status, page }, { signal: controller.signal }).then((result) => {
      if (active) setList({ ...result, loading: false, error: "" });
    }, () => {
      if (active) setList({ items: [], total: 0, loading: false, error: "Cererile nu pot fi încărcate momentan." });
    });
    return () => { active = false; controller.abort(); };
  }, [q, status, page, revision, request, sessionStatus]);

  const changeFilters = (nextPage, nextSearch = q, nextStatus = status) => {
    if (blocked) return;
    const next = new URLSearchParams(params);
    next.set("page", String(nextPage));
    if (nextSearch.trim()) next.set("q", nextSearch.trim()); else next.delete("q");
    if (nextStatus) next.set("status", nextStatus); else next.delete("status");
    setParams(next);
  };
  if (sessionStatus !== "authenticated") return <p role="status">Este necesară o sesiune Admin activă.</p>;
  const pages = Math.min(1000, Math.max(1, Math.ceil(list.total / 25)));
  return <section className="admin-module-view" aria-label="Cereri de ofertă" style={wrap}>
    <header><h1>Cereri de ofertă</h1><p>Consultă solicitările și urmărește discuțiile cu clienții.</p></header>
    <form aria-label="Filtrează cererile" onSubmit={(event) => { event.preventDefault(); changeFilters(1, search, filter); }}>
      <fieldset disabled={blocked} style={{ ...rowStyle, border: 0, padding: 0, minWidth: 0 }}>
        <legend className="admin-visually-hidden">Filtre</legend>
        <div className="admin-field" style={{ flex: "1 1 220px" }}><label htmlFor="quote-search">Caută cereri</label>
          <input id="quote-search" name="quote-search" type="search" maxLength={120} value={search} onChange={(event) => setSearch(event.target.value)} /></div>
        <div className="admin-field"><label htmlFor="quote-filter">Filtrează după status</label>
          <select id="quote-filter" name="quote-filter" value={filter} onChange={(event) => setFilter(event.target.value)}><option value="">Toate statusurile</option><StatusOptions /></select></div>
        <button className="admin-button" type="submit">Aplică filtrele</button>
      </fieldset>
    </form>
    {blocked && <p>Salvează sau anulează modificările înainte de a schimba cererea ori filtrele.</p>}
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))", gap: 20, marginTop: 20 }}>
      <div style={wrap}>
        {list.loading && <p role="status">Se încarcă cererile…</p>}
        {list.error && <div role="alert">{list.error} <button className="admin-button" onClick={refresh}>Încearcă din nou</button></div>}
        {!list.loading && !list.error && <p role="status">{list.total ? `${list.total} cereri` : "Nu există cereri pentru filtrele alese."}</p>}
        <ul aria-label="Lista cererilor" style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 8 }}>
          {list.items.map((item) => <li key={item.id} style={wrap}>
            <button type="button" className="admin-button" aria-label={`Deschide cererea ${nameOf(item)}`} aria-pressed={selected === item.id}
              disabled={blocked} onClick={() => setSelected(item.id)}
              style={{ width: "100%", flexDirection: "column", alignItems: "flex-start", textAlign: "left", whiteSpace: "normal", ...wrap }}>
              <strong>{nameOf(item)}</strong><span>{formatDate(item.created_at)}</span>
              <span>{item.event_type} · {item.event_date} · {item.locality}</span>
              <span>{item.package_title || "Pachet neselectat"} · {QUOTE_STATUSES[item.status] || item.status}</span>
            </button>
          </li>)}
        </ul>
        <nav aria-label="Paginarea cererilor" style={{ ...rowStyle, marginTop: 16 }}>
          <button className="admin-button" disabled={blocked || list.loading || page <= 1} onClick={() => changeFilters(page - 1)}>Pagina precedentă</button>
          <span>Pagina {page} din {pages}</span>
          <button className="admin-button" disabled={blocked || list.loading || page >= pages} onClick={() => changeFilters(page + 1)}>Pagina următoare</button>
        </nav>
      </div>
      {selected ? <QuoteDetail key={selected} id={selected} request={request} onSaved={refresh} onBlocked={setBlocked} /> : <p>Selectează o cerere pentru detalii.</p>}
    </div>
  </section>;
}
