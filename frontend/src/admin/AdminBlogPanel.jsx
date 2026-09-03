import { useEffect, useState } from "react";
import { ImagePlus, Plus, Save, Trash2 } from "lucide-react";
import { useAdminSession } from "@/admin/AdminSessionContext";
import { prepareAdminImage } from "@/admin/imageUtils";
import {
  blogMediaUrl,
  createAdminPost,
  deleteAdminPost,
  listAdminPosts,
  updateAdminPost,
  uploadAdminCover,
} from "@/lib/blogApi";

const EMPTY_ARTICLE = {
  title: "",
  excerpt: "",
  body: "",
  category: "",
  cover_media_id: "",
  cover_alt: "",
  status: "draft",
};

const articlePayload = (article) => ({
  title: article.title,
  excerpt: article.excerpt,
  body: article.body,
  category: article.category,
  cover_media_id: article.cover_media_id,
  cover_alt: article.cover_alt,
});

const errorMessage = (error) => {
  if (error?.status === 401) {
    return "Sesiunea Admin a expirat. Autentifică-te din nou.";
  }
  return error?.message || "Operațiunea nu a putut fi finalizată.";
};

export default function AdminBlogPanel() {
  const { request, status } = useAdminSession();
  const [loadState, setLoadState] = useState("loading");
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [posts, setPosts] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [draft, setDraft] = useState(null);
  const [message, setMessage] = useState("");
  const [tone, setTone] = useState("neutral");
  const [busy, setBusy] = useState(false);

  const setNotice = (nextMessage, nextTone = "neutral") => {
    setMessage(nextMessage);
    setTone(nextTone);
  };

  useEffect(() => {
    if (status !== "authenticated") return;
    let active = true;
    const controller = new AbortController();
    setLoadState("loading");
    setMessage("");
    setTone("neutral");

    async function loadArticles() {
      try {
        const result = await listAdminPosts(request, { signal: controller.signal });
        if (!active) return;
        setPosts(result);
        setSelectedId(result[0]?.id || "");
        setDraft(result[0] || null);
        setLoadState("ready");
      } catch (error) {
        if (!active) return;
        setMessage(errorMessage(error));
        setTone("error");
        setLoadState("error");
      }
    }

    loadArticles();
    return () => {
      active = false;
      controller.abort();
    };
  }, [request, status, loadAttempt]);

  const newArticle = () => {
    setSelectedId("");
    setDraft({ ...EMPTY_ARTICLE });
    setNotice("");
  };

  const selectArticle = (article) => {
    setSelectedId(article.id);
    setDraft({ ...article });
    setNotice("");
  };

  const updateDraft = (key, value) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const uploadCover = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !draft) return;
    setBusy(true);
    setNotice("Imaginea se optimizează și se încarcă…");
    try {
      const prepared = await prepareAdminImage(file);
      const media = await uploadAdminCover(request, prepared);
      setDraft((current) => ({ ...current, cover_media_id: media.id }));
      setNotice("Imaginea a fost încărcată.", "success");
    } catch (error) {
      setNotice(errorMessage(error), "error");
    } finally {
      setBusy(false);
    }
  };

  const saveArticle = async (event) => {
    event.preventDefault();
    if (!draft) return;
    setBusy(true);
    setNotice("");
    try {
      const saved = draft.id
        ? await updateAdminPost(request, draft.id, {
            ...articlePayload(draft),
            status: draft.status,
          })
        : await createAdminPost(request, articlePayload(draft));

      setPosts((current) => {
        const exists = current.some((article) => article.id === saved.id);
        return exists
          ? current.map((article) => (article.id === saved.id ? saved : article))
          : [saved, ...current];
      });
      setSelectedId(saved.id);
      setDraft(saved);
      setNotice(saved.status === "published" ? "Articol publicat." : "Draft salvat.", "success");
    } catch (error) {
      setNotice(errorMessage(error), "error");
    } finally {
      setBusy(false);
    }
  };

  const removeArticle = async () => {
    if (!draft?.id || !window.confirm("Ștergi definitiv acest articol?")) return;
    setBusy(true);
    setNotice("");
    try {
      await deleteAdminPost(request, draft.id);
      const remaining = posts.filter((article) => article.id !== draft.id);
      setPosts(remaining);
      setSelectedId(remaining[0]?.id || "");
      setDraft(remaining[0] || null);
      setNotice("Articolul a fost șters.", "success");
    } catch (error) {
      setNotice(errorMessage(error), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="admin-blog-view">
      <header className="admin-page-heading admin-module-heading">
        <div>
          <span>{posts.length} {posts.length === 1 ? "articol" : "articole"}</span>
          <h1>Blog</h1>
          <p>Creează drafturi, adaugă imaginea de copertă și publică atunci când articolul este gata.</p>
        </div>
        {draft && (
          <div>
            <button type="button" className="admin-button is-primary" onClick={newArticle} disabled={busy}>
              <Plus aria-hidden="true" /> Articol nou
            </button>
          </div>
        )}
      </header>

      {!draft && message && <p className={`admin-blog-message is-${tone}`} role="status">{message}</p>}

      {loadState === "loading" && <p role="status">Se încarcă articolele…</p>}

      {loadState === "error" && (
        <button type="button" className="admin-button" onClick={() => setLoadAttempt((current) => current + 1)}>
          Reîncearcă
        </button>
      )}

      {loadState === "ready" && !draft && (
        <section className="admin-blog-empty">
          <p>Nu există articole. Creează primul articol.</p>
          <button type="button" className="admin-button is-primary" onClick={newArticle}>
            <Plus aria-hidden="true" /> Articol nou
          </button>
        </section>
      )}

      {draft && (
        <div className="admin-blog-layout">
          <aside className="admin-blog-list" aria-label="Articole Blog">
            {posts.length ? posts.map((article) => (
              <button
                key={article.id}
                type="button"
                className={selectedId === article.id ? "is-active" : ""}
                onClick={() => selectArticle(article)}
                disabled={busy}
              >
                <strong>{article.title || "Fără titlu"}</strong>
                <span>{article.slug}</span>
                <small>{article.status === "published" ? "Publicat" : "Draft"}</small>
              </button>
            )) : (
              <p>Articol nou, nesalvat</p>
            )}
          </aside>

          <form className="admin-blog-form" onSubmit={saveArticle}>
            <div className="admin-blog-form-head">
              <div>
                <span>{draft.id ? "Editare articol" : "Draft nou"}</span>
                <h2>{draft.title || "Articol fără titlu"}</h2>
                {draft.slug && <code>{draft.slug}</code>}
              </div>
              {draft.id && (
                <button type="button" className="admin-button is-danger-quiet" onClick={removeArticle} disabled={busy}>
                  <Trash2 aria-hidden="true" /> Șterge articolul
                </button>
              )}
            </div>

            <div className="admin-blog-fields">
              <label>
                <span>Titlu</span>
                <input value={draft.title} onChange={(event) => updateDraft("title", event.target.value)} maxLength={160} required />
              </label>
              <label>
                <span>Categorie</span>
                <input value={draft.category} onChange={(event) => updateDraft("category", event.target.value)} maxLength={80} />
              </label>
              <label className="is-wide">
                <span>Descriere scurtă</span>
                <textarea value={draft.excerpt} onChange={(event) => updateDraft("excerpt", event.target.value)} maxLength={320} rows={3} />
              </label>
              <label className="is-wide">
                <span>Conținut</span>
                <textarea value={draft.body} onChange={(event) => updateDraft("body", event.target.value)} maxLength={50000} rows={14} required />
                <small>Separă paragrafele cu un rând liber.</small>
              </label>
              <label className="admin-blog-cover is-wide">
                <span>Imagine de copertă</span>
                {draft.cover_media_id ? (
                  <img src={blogMediaUrl(draft.cover_media_id)} alt={draft.cover_alt || "Previzualizare copertă"} />
                ) : (
                  <span className="admin-blog-cover-placeholder"><ImagePlus aria-hidden="true" /> Nicio imagine încărcată</span>
                )}
                <input type="file" accept="image/jpeg,image/png,image/webp,image/avif" onChange={uploadCover} disabled={busy} />
              </label>
              <label className="is-wide">
                <span>Text alternativ</span>
                <input value={draft.cover_alt} onChange={(event) => updateDraft("cover_alt", event.target.value)} maxLength={240} required={Boolean(draft.cover_media_id)} />
              </label>
              <label className="admin-blog-published is-wide">
                <span>
                  <strong>Publicat</strong>
                  <small>Activează numai când articolul este pregătit pentru site.</small>
                </span>
                <input
                  type="checkbox"
                  checked={draft.status === "published"}
                  onChange={(event) => updateDraft("status", event.target.checked ? "published" : "draft")}
                  disabled={!draft.id || busy}
                />
              </label>
            </div>

            <footer className="admin-blog-form-actions">
              {message && <p className={`admin-blog-message is-${tone}`} role="status">{message}</p>}
              <button type="submit" className="admin-button is-primary" disabled={busy}>
                <Save aria-hidden="true" /> {busy ? "Se salvează…" : "Salvează articolul"}
              </button>
            </footer>
          </form>
        </div>
      )}
    </div>
  );
}
