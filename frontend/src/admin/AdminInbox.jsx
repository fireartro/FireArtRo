import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Mail, Paperclip, RefreshCw, Send } from "lucide-react";
import { useAdminSession } from "./AdminSessionContext";
import {
  createReplyId,
  getInboxMessage,
  INBOX_CATEGORIES,
  listInboxMessages,
  replyToInboxMessage,
  retryInboxRelay,
} from "../lib/inboxApi";

const EMPTY_LIST = { items: [], total: 0, page: 1, page_size: 20 };
const RELAY_LABELS = {
  pending: "Notificare în curs",
  sent: "Notificare trimisă",
  failed: "Notificare eșuată",
};

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Dată indisponibilă" : date.toLocaleString("ro-RO");
}

function formatSize(value) {
  if (!Number.isFinite(value) || value < 0) return "mărime necunoscută";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function InboxDetail({ message, busy, replyText, replyError, replyStatus, onReplyText, onReply, onRetryRelay, onReload }) {
  return <article className="admin-inbox-detail" aria-label={`Mesaj de la ${message.from}`}>
    <header className="admin-inbox-detail__header">
      <div>
        <p className="admin-inbox-kicker">{INBOX_CATEGORIES[message.category] || "Mesaj"}</p>
        <h2>{message.subject || "Fără subiect"}</h2>
        <p><strong>{message.from}</strong> · {formatDate(message.received_at)}</p>
      </div>
      <span className={`admin-inbox-state is-${message.relay_state}`}>
        {RELAY_LABELS[message.relay_state] || message.relay_state}
      </span>
    </header>

    <section className="admin-inbox-message" aria-label="Conținut mesaj">
      <p>{message.text || "Mesajul nu conține text simplu."}</p>
    </section>

    {message.attachments?.length > 0 ? <section className="admin-inbox-attachments" aria-label="Atașamente">
      <h3><Paperclip aria-hidden="true" /> Atașamente</h3>
      <ul>{message.attachments.map((item) => <li key={item.id || item.filename}>
        <strong>{item.filename || "Fișier fără nume"}</strong>
        <span>{item.content_type || "tip necunoscut"} · {formatSize(item.size)}</span>
      </li>)}</ul>
    </section> : null}

    {message.replies?.length > 0 ? <section className="admin-inbox-thread" aria-label="Răspunsuri trimise">
      <h3>Răspunsuri trimise</h3>
      <ol>{message.replies.map((item) => <li key={item.id}>
        <div><span>{formatDate(item.created_at)}</span><span className={`admin-inbox-state is-${item.state}`}>{item.state === "sent" ? "Trimis" : item.state === "failed" ? "Eșuat" : "În curs"}</span></div>
        <p>{item.text}</p>
      </li>)}</ol>
    </section> : null}

    {message.relay_state === "failed" ? <div className="admin-inbox-relay-action">
      <p>Notificarea către adresa de administrare nu a ajuns.</p>
      <button className="admin-button" type="button" disabled={busy} onClick={onRetryRelay}>
        <RefreshCw aria-hidden="true" /> Retrimite notificarea
      </button>
    </div> : null}

    <form className="admin-inbox-reply" aria-label="Răspunde la mesaj" onSubmit={onReply}>
      <div className="admin-field">
        <div className="admin-field-label">
          <label htmlFor="inbox-reply">Răspuns către {message.from}</label>
          <small>{replyText.length}/12000</small>
        </div>
        <textarea id="inbox-reply" name="inbox-reply" rows={7} maxLength={12000} value={replyText}
          disabled={busy} onChange={(event) => onReplyText(event.target.value)} />
      </div>
      <div className="admin-inbox-reply__actions">
        <button className="admin-button is-primary" type="submit" disabled={busy}>
          <Send aria-hidden="true" /> {busy ? "Se trimite…" : "Trimite răspunsul"}
        </button>
        {replyError ? <button className="admin-button" type="button" onClick={onReload}>Reîncarcă mesajul</button> : null}
        <span role="status">{replyStatus}</span>
      </div>
      {replyError ? <p className="cms-error" role="alert">{replyError}</p> : null}
    </form>
  </article>;
}

export default function AdminInbox() {
  const { request, status: sessionStatus } = useAdminSession();
  const [input, setInput] = useState({ q: "", category: "" });
  const [filters, setFilters] = useState({ q: "", category: "", page: 1 });
  const [listState, setListState] = useState({ data: EMPTY_LIST, loading: true, error: "" });
  const [selectedId, setSelectedId] = useState(null);
  const [detailState, setDetailState] = useState({ data: null, loading: false, error: "" });
  const [revision, setRevision] = useState(0);
  const [replyText, setReplyText] = useState("");
  const [replyId, setReplyId] = useState(createReplyId);
  const [replyState, setReplyState] = useState({ busy: false, error: "", status: "" });
  const operationRef = useRef(0);
  const blocked = replyState.busy || Boolean(replyText.trim());

  useEffect(() => {
    if (sessionStatus === "authenticated") return;
    operationRef.current += 1;
    setListState({ data: EMPTY_LIST, loading: false, error: "" });
    setSelectedId(null);
    setDetailState({ data: null, loading: false, error: "" });
    setReplyText("");
    setReplyState({ busy: false, error: "", status: "" });
  }, [sessionStatus]);

  useEffect(() => {
    if (sessionStatus !== "authenticated") return undefined;
    let active = true;
    const controller = new AbortController();
    setListState((current) => ({ ...current, loading: true, error: "" }));
    listInboxMessages(request, filters, { signal: controller.signal }).then((data) => {
      if (!active) return;
      setListState({ data, loading: false, error: "" });
    }, () => {
      if (!active) return;
      setListState({ data: EMPTY_LIST, loading: false, error: "Mesajele nu pot fi încărcate momentan." });
    });
    return () => { active = false; controller.abort(); };
  }, [filters, request, revision, sessionStatus]);

  useEffect(() => {
    if (sessionStatus !== "authenticated" || !selectedId) return undefined;
    const operation = ++operationRef.current;
    const controller = new AbortController();
    setDetailState({ data: null, loading: true, error: "" });
    getInboxMessage(request, selectedId, { signal: controller.signal }).then((data) => {
      if (operation === operationRef.current) setDetailState({ data, loading: false, error: "" });
    }, () => {
      if (operation === operationRef.current) setDetailState({ data: null, loading: false, error: "Mesajul nu poate fi încărcat momentan." });
    });
    return () => controller.abort();
  }, [request, revision, selectedId, sessionStatus]);

  const reload = useCallback(() => {
    setReplyState((current) => ({ ...current, error: "", status: "" }));
    setRevision((value) => value + 1);
  }, []);

  const selectMessage = useCallback((id) => {
    if (blocked) return;
    setSelectedId(id);
    setReplyText("");
    setReplyId(createReplyId());
    setReplyState({ busy: false, error: "", status: "" });
  }, [blocked]);

  const submitFilters = useCallback((event) => {
    event.preventDefault();
    if (blocked) return;
    setSelectedId(null);
    setFilters({ q: input.q.trim().slice(0, 200), category: input.category, page: 1 });
  }, [blocked, input]);

  async function sendReply(event) {
    event.preventDefault();
    const text = replyText.trim();
    if (!text) {
      setReplyState({ busy: false, error: "Scrie un răspuns înainte de trimitere.", status: "" });
      return;
    }
    if (text.length > 12000 || replyState.busy || !detailState.data) return;
    const operation = ++operationRef.current;
    setReplyState({ busy: true, error: "", status: "" });
    try {
      const updated = await replyToInboxMessage(request, detailState.data.id, text, replyId);
      if (operation !== operationRef.current || updated?.id !== detailState.data.id) return;
      setDetailState({ data: updated, loading: false, error: "" });
      setReplyText("");
      setReplyId(createReplyId());
      setReplyState({ busy: false, error: "", status: "Răspuns trimis." });
    } catch (error) {
      if (operation !== operationRef.current) return;
      if (error?.status === 401) return;
      if (error?.status === 409) setReplyId(createReplyId());
      setReplyState({
        busy: false,
        error: error?.status === 409
          ? "Răspunsul intră în conflict cu o încercare anterioară. Reîncarcă mesajul pentru a continua."
          : "Trimiterea nu a fost confirmată. Răspunsul local este păstrat.",
        status: "",
      });
    }
  }

  async function retryRelay() {
    if (replyState.busy || !detailState.data) return;
    const operation = ++operationRef.current;
    setReplyState({ busy: true, error: "", status: "" });
    try {
      const updated = await retryInboxRelay(request, detailState.data.id);
      if (operation !== operationRef.current || updated?.id !== detailState.data.id) return;
      setDetailState({ data: updated, loading: false, error: "" });
      setReplyState({ busy: false, error: "", status: "Notificare retrimisă." });
    } catch (error) {
      if (operation !== operationRef.current || error?.status === 401) return;
      setReplyState({ busy: false, error: "Notificarea nu a putut fi retrimisă.", status: "" });
    }
  }

  const pages = useMemo(
    () => Math.min(1000, Math.max(1, Math.ceil(listState.data.total / 20))),
    [listState.data.total],
  );

  if (sessionStatus !== "authenticated") {
    return <p role="status">Este necesară o sesiune Admin activă.</p>;
  }

  return <section className="cms-panel admin-inbox" aria-label="Mesaje primite">
    <header className="admin-inbox-heading">
      <div><p className="admin-inbox-kicker"><Mail aria-hidden="true" /> Corespondență</p><h1>Mesaje</h1></div>
      <p>Primește mesajele trimise către contact@fireart.ro și răspunde din același fir.</p>
    </header>

    <form className="admin-inbox-filters" aria-label="Filtrează mesajele" onSubmit={submitFilters}>
      <div className="admin-field"><label htmlFor="inbox-search">Caută după expeditor sau subiect</label>
        <input id="inbox-search" name="inbox-search" type="search" maxLength={200} value={input.q}
          disabled={blocked} onChange={(event) => setInput((current) => ({ ...current, q: event.target.value }))} /></div>
      <div className="admin-field"><label htmlFor="inbox-category">Destinație</label>
        <select id="inbox-category" name="inbox-category" value={input.category} disabled={blocked}
          onChange={(event) => setInput((current) => ({ ...current, category: event.target.value }))}>
          <option value="">Toate mesajele</option>
          {Object.entries(INBOX_CATEGORIES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select></div>
      <button className="admin-button" type="submit" disabled={blocked}>Aplică filtrele</button>
    </form>
    {blocked ? <p className="admin-inbox-guard">Trimite sau golește răspunsul înainte de a schimba mesajul ori filtrele.</p> : null}

    <div className="admin-inbox-workspace">
      <aside className="admin-inbox-list" aria-label="Lista mesajelor">
        {listState.loading ? <p role="status">Se încarcă mesajele…</p> : null}
        {listState.error ? <div className="cms-notice is-error" role="alert"><span>{listState.error}</span><button className="admin-button" onClick={() => setRevision((value) => value + 1)}>Încearcă din nou</button></div> : null}
        {!listState.loading && !listState.error ? <p className="admin-inbox-count" role="status">{listState.data.total ? `${listState.data.total} mesaje` : "Nu există mesaje pentru filtrele alese."}</p> : null}
        <ul>{listState.data.items.map((item) => <li key={item.id}>
          <button type="button" className={selectedId === item.id ? "is-active" : ""}
            aria-label={`Deschide mesajul ${item.subject || "Fără subiect"}`} aria-pressed={selectedId === item.id}
            disabled={blocked && selectedId !== item.id} onClick={() => selectMessage(item.id)}>
            <span><strong>{item.from}</strong><time>{formatDate(item.received_at)}</time></span>
            <b>{item.subject || "Fără subiect"}</b>
            <small>{INBOX_CATEGORIES[item.category] || "Mesaj"} · {RELAY_LABELS[item.relay_state] || item.relay_state}</small>
          </button>
        </li>)}</ul>
        <nav aria-label="Paginarea mesajelor">
          <button className="admin-button" type="button" disabled={blocked || listState.loading || filters.page <= 1}
            onClick={() => setFilters((current) => ({ ...current, page: current.page - 1 }))}>Înapoi</button>
          <span>{filters.page} / {pages}</span>
          <button className="admin-button" type="button" disabled={blocked || listState.loading || filters.page >= pages}
            onClick={() => setFilters((current) => ({ ...current, page: current.page + 1 }))}>Înainte</button>
        </nav>
      </aside>

      <div className="admin-inbox-reader">
        {detailState.loading ? <p role="status">Se încarcă mesajul…</p> : null}
        {detailState.error ? <div className="cms-notice is-error" role="alert"><span>{detailState.error}</span><button className="admin-button" onClick={reload}>Reîncarcă mesajul</button></div> : null}
        {!detailState.loading && !detailState.error && !detailState.data ? <div className="admin-inbox-empty"><Mail aria-hidden="true" /><h2>Selectează un mesaj</h2><p>Conținutul și răspunsurile apar aici.</p></div> : null}
        {detailState.data ? <InboxDetail message={detailState.data} busy={replyState.busy} replyText={replyText}
          replyError={replyState.error} replyStatus={replyState.status} onReplyText={(value) => {
            setReplyText(value); setReplyState((current) => ({ ...current, error: "", status: "" }));
          }} onReply={sendReply} onRetryRelay={retryRelay} onReload={reload} /> : null}
      </div>
    </div>
  </section>;
}
