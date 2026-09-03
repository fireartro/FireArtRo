import { ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";
import { blogMediaUrl } from "@/lib/blogApi";
import "@/styles/night-blog.css";

const roDate = new Intl.DateTimeFormat("ro-RO", {
  day: "2-digit",
  month: "long",
  year: "numeric",
});

export default function BlogCard({ article, variant = "standard" }) {
  const href = `/blog/${article.slug}`;
  const date = article.published_at
    ? roDate.format(new Date(article.published_at))
    : "";
  const cover = blogMediaUrl(article.cover_media_id);

  return (
    <article className={`fa-blog-card is-${variant}`} data-testid="blog-card">
      {cover && (
        <Link className="fa-blog-card__media" to={href} tabIndex={-1}>
          <img
            src={cover}
            alt={article.cover_alt}
            loading="lazy"
            decoding="async"
          />
        </Link>
      )}
      <div className="fa-blog-card__copy">
        {(article.category || date) && (
          <p className="fa-blog-card__meta">
            {article.category && <span>{article.category}</span>}
            {date && <time dateTime={article.published_at}>{date}</time>}
          </p>
        )}
        <h3><Link to={href}>{article.title}</Link></h3>
        {article.excerpt && (
          <p className="fa-blog-card__excerpt">{article.excerpt}</p>
        )}
        <Link className="fa-blog-card__link" to={href}>
          Citește articolul <ArrowUpRight aria-hidden="true" />
        </Link>
      </div>
    </article>
  );
}
