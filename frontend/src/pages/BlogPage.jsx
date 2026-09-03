import { useEffect, useMemo, useState } from "react";
import BlogCard from "@/components/blog/BlogCard";
import NightButton from "@/components/night/NightButton";
import Navbar from "@/components/site/Navbar";
import PageEnd from "@/components/site/PageEnd";
import ScrollProgress from "@/components/site/ScrollProgress";
import { CMS_DEFAULTS } from "@/data/cmsDefaults";
import usePageMeta from "@/hooks/usePageMeta";
import { listPublishedPosts } from "@/lib/blogApi";
import useManagedContent from "@/hooks/useManagedContent";

export default function BlogPage() {
  const copy = useManagedContent("blogPage", CMS_DEFAULTS.blogPage);
  const siteDetails = useManagedContent("siteDetails", CMS_DEFAULTS.siteDetails);
  const [requestVersion, setRequestVersion] = useState(0);
  const [state, setState] = useState({
    loading: true,
    posts: [],
    error: "",
  });

  useEffect(() => {
    const controller = new AbortController();
    setState((current) => ({ ...current, loading: true, error: "" }));
    listPublishedPosts({ signal: controller.signal })
      .then((posts) => setState({ loading: false, posts, error: "" }))
      .catch((error) => {
        if (error.name !== "AbortError") {
          setState({
            loading: false,
            posts: [],
            error: "Articolele nu au putut fi încărcate.",
          });
        }
      });
    return () => controller.abort();
  }, [requestVersion]);

  const schema = useMemo(() => ({
    "@context": "https://schema.org",
    "@type": "Blog",
    name: `${copy.title} ${siteDetails.name}`,
    url: `${siteDetails.siteUrl}/blog`,
    blogPost: state.posts.map((post) => ({
      "@type": "BlogPosting",
      headline: post.title,
      datePublished: post.published_at,
      url: `${siteDetails.siteUrl}/blog/${post.slug}`,
    })),
  }), [copy.title, siteDetails.name, siteDetails.siteUrl, state.posts]);

  usePageMeta({
    title: copy.seoTitle,
    description: copy.seoDescription,
    path: "/blog",
    schema,
  });

  return (
    <div className="fa-blog-route">
      <ScrollProgress />
      <Navbar />
      <main className="fa-blog-page" data-design="night-runway">
        <header className="fa-blog-hero">
          <div className="nr-shell">
            <p className="fa-kicker">{copy.eyebrow}</p>
            <h1>{copy.title}</h1>
            <p>{copy.description}</p>
          </div>
        </header>

        <section className="fa-blog-archive nr-section" aria-live="polite">
          <div className="nr-shell">
            {state.loading ? (
              <p className="fa-blog-state" role="status">Se încarcă articolele…</p>
            ) : state.error ? (
              <div className="fa-blog-state is-error">
                <p>{state.error}</p>
                <NightButton
                  onClick={() => setRequestVersion((value) => value + 1)}
                  showArrow={false}
                  variant="secondary"
                >
                  Încearcă din nou
                </NightButton>
              </div>
            ) : state.posts.length === 0 ? (
              <p className="fa-blog-state">Nu există articole publicate momentan.</p>
            ) : (
              <div className="fa-blog-grid">
                {state.posts.map((post) => (
                  <BlogCard article={post} key={post.id} />
                ))}
              </div>
            )}
          </div>
        </section>
      </main>
      <PageEnd />
    </div>
  );
}
