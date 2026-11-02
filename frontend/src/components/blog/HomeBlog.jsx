import { useEffect, useState } from "react";
import BlogCard from "@/components/blog/BlogCard";
import NightButton from "@/components/night/NightButton";
import { listPublishedPosts } from "@/lib/blogApi";
import { watchBlogPublications } from "@/lib/blogPublicationSync";
import { usePublicRenderData } from '@/content/PublicRenderData';

export default function HomeBlog() {
  const initialData = usePublicRenderData();
  const [posts, setPosts] = useState(() => initialData?.pathname === '/' && Array.isArray(initialData.posts)
    ? initialData.posts.slice(0, 3) : null);

  useEffect(() => {
    let active = true, controller;
    const load = async (background = false, signal) => {
      controller?.abort();
      const request = new AbortController();
      controller = request;
      const abort = () => request.abort();
      signal?.addEventListener("abort", abort, { once: true });
      try {
        const items = await listPublishedPosts({ limit: 3, signal: request.signal });
        if (!active || request.signal.aborted) return false;
        setPosts(items.slice(0, 3));
        return true;
      } catch (error) {
        if (active && !request.signal.aborted && error.name !== "AbortError" && !background) setPosts([]);
        return false;
      } finally { signal?.removeEventListener("abort", abort); }
    };
    load();
    const stop = watchBlogPublications({ refresh: ({ signal }) => load(true, signal) });
    return () => { active = false; stop(); controller?.abort(); };
  }, []);

  if (!posts?.length) return null;

  return (
    <section
      className="fa-home-blog nr-section"
      data-testid="home-blog"
      aria-labelledby="home-blog-title"
    >
      <div className="nr-shell">
        <header className="fa-home-blog__head">
          <p className="fa-kicker">Jurnal FireArtRo</p>
          <h2 id="home-blog-title">Ultimele articole</h2>
        </header>
        <div className="fa-home-blog__grid">
          <BlogCard article={posts[0]} variant="lead" />
          {posts.length > 1 && (
            <div className="fa-home-blog__secondary">
              {posts.slice(1).map((post) => (
                <BlogCard article={post} variant="compact" key={post.id} />
              ))}
            </div>
          )}
        </div>
        <NightButton to="/blog" variant="secondary">
          Vezi tot blogul
        </NightButton>
      </div>
    </section>
  );
}
