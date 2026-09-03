import { useEffect, useState } from "react";
import BlogCard from "@/components/blog/BlogCard";
import NightButton from "@/components/night/NightButton";
import { listPublishedPosts } from "@/lib/blogApi";

export default function HomeBlog() {
  const [posts, setPosts] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    listPublishedPosts({ limit: 3, signal: controller.signal })
      .then((items) => setPosts(items.slice(0, 3)))
      .catch((error) => {
        if (error.name !== "AbortError") setPosts([]);
      });
    return () => controller.abort();
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
