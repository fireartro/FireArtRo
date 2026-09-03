import { ArrowUpRight } from "lucide-react";

export default function FacebookReviews({ facebookHref, testimonials = [] }) {
  const reviewsHref = `${(facebookHref || "https://www.facebook.com/FireArtRo").replace(/\/$/, "")}/reviews`;
  const verifiedReviews = testimonials.filter((item) =>
    String(item.source || "").toLowerCase() === "facebook" && item.replaceable === false,
  );

  return (
    <section className="fa-facebook-reviews" data-testid="facebook-reviews" aria-labelledby="fa-facebook-reviews-title">
      <div>
        <p>Recenzii publice</p>
        <h2 id="fa-facebook-reviews-title">Experiențe verificate pe Facebook.</h2>
      </div>

      {verifiedReviews.length > 0 && (
        <div className="fa-facebook-reviews__quotes">
          {verifiedReviews.slice(0, 3).map((review) => (
            <blockquote key={review.id}>
              <p>„{review.quote}”</p>
              <cite>{review.name}</cite>
            </blockquote>
          ))}
        </div>
      )}

      <a href={reviewsHref} target="_blank" rel="noopener noreferrer">
        <span>Vezi recenziile pe Facebook</span>
        <ArrowUpRight aria-hidden="true" />
      </a>
    </section>
  );
}
