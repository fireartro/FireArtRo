import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import BlogBody from "@/components/blog/BlogBody";
import NightButton from "@/components/night/NightButton";
import Navbar from "@/components/site/Navbar";
import PageEnd from "@/components/site/PageEnd";
import ScrollProgress from "@/components/site/ScrollProgress";
import { CMS_DEFAULTS } from "@/data/cmsDefaults";
import { CANONICAL_SITE_URL } from "@/data/businessContent";
import usePageMeta from "@/hooks/usePageMeta";
import useManagedContent from "@/hooks/useManagedContent";
import {
  blogMediaUrl,
  getPublishedPost,
} from "@/lib/blogApi";
import { watchBlogPublications } from "@/lib/blogPublicationSync";
import "@/styles/night-blog.css";

const roDate = new Intl.DateTimeFormat("ro-RO", {
  day: "2-digit",
  month: "long",
  year: "numeric",
});

export default function BlogArticlePage() {
  const { slug } = useParams();
  const siteDetails = useManagedContent("siteDetails", CMS_DEFAULTS.siteDetails);
  const [requestVersion, setRequestVersion] = useState(0);
  const [state, setState] = useState({
    loading: true,
    post: null,
    error: "",
    notFound: false,
  });

  useEffect(() => {
    let active = true, controller;
    setState({ loading: true, post: null, error: "", notFound: false });
    const load = async (background = false, signal) => {
      controller?.abort();
      const request = new AbortController();
      controller = request;
      const abort = () => request.abort();
      signal?.addEventListener("abort", abort, { once: true });
      try {
        const post = await getPublishedPost(slug, { signal: request.signal });
        if (!active || request.signal.aborted) return false;
        setState({ loading: false, post, error: "", notFound: false });
        return true;
      } catch (error) {
        if (!active || request.signal.aborted || error.name === "AbortError") return false;
        if (error.status === 404 || !background) {
          setState({
            loading: false,
            post: null,
            error: error.status === 404 ? "Articolul nu a fost găsit." : "Articolul nu a putut fi încărcat.",
            notFound: error.status === 404,
          });
        }
        return error.status === 404;
      } finally { signal?.removeEventListener("abort", abort); }
    };
    load();
    const stop = watchBlogPublications({ refresh: ({ signal }) => load(true, signal) });
    return () => { active = false; stop(); controller?.abort(); };
  }, [requestVersion, slug]);

  const image = state.post?.cover_media_id
    ? blogMediaUrl(state.post.cover_media_id)
    : "/media/fireart-hero-poster.webp";
  const schema = useMemo(() => state.post ? {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: state.post.title,
    description: state.post.excerpt || undefined,
    datePublished: state.post.published_at,
    dateModified: state.post.updated_at,
    image: state.post.cover_media_id ? image : undefined,
    mainEntityOfPage: `${CANONICAL_SITE_URL}/blog/${state.post.slug}`,
  } : undefined, [image, state.post]);

  usePageMeta({
    title: state.post ? `${state.post.title} — ${siteDetails.name}` : `Articol — ${siteDetails.name}`,
    description: state.post?.excerpt || "Articol din Blogul FireArtRo.",
    path: `/blog/${slug}`,
    image,
    noindex: state.notFound,
    schema,
  });

  return (
    <div className="fa-blog-route">
      <ScrollProgress />
      <Navbar />
      <main className="fa-blog-page" data-design="night-runway">
        {state.loading ? (
          <p className="fa-blog-state fa-blog-article-state" role="status">
            Se încarcă articolul…
          </p>
        ) : state.post ? (
          <article className="fa-blog-article">
            <Link className="fa-blog-back" to="/blog">Înapoi la Blog</Link>
            <header className="fa-blog-article__head">
              {(state.post.category || state.post.published_at) && (
                <p className="fa-blog-card__meta">
                  {state.post.category && <span>{state.post.category}</span>}
                  {state.post.published_at && (
                    <time dateTime={state.post.published_at}>
                      {roDate.format(new Date(state.post.published_at))}
                    </time>
                  )}
                </p>
              )}
              <h1>{state.post.title}</h1>
              {state.post.excerpt && <p>{state.post.excerpt}</p>}
            </header>
            {state.post.cover_media_id && (
              <figure className="fa-blog-article__cover">
                <img src={image} alt={state.post.cover_alt} />
              </figure>
            )}
            <BlogBody body={state.post.body} />
          </article>
        ) : (
          <section className="fa-blog-state fa-blog-article-state">
            <p>{state.error}</p>
            {state.notFound ? (
              <NightButton to="/blog" variant="secondary">
                Înapoi la Blog
              </NightButton>
            ) : (
              <NightButton
                onClick={() => setRequestVersion((value) => value + 1)}
                showArrow={false}
                variant="secondary"
              >
                Încearcă din nou
              </NightButton>
            )}
          </section>
        )}
      </main>
      <PageEnd />
    </div>
  );
}
