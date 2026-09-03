import { CMS_DEFAULTS } from "@/data/cmsDefaults";
import { ArrowUpRight, Quote } from "lucide-react";
import Reveal from "@/components/site/Reveal";
import { SectionHeader } from "@/components/site/cinematic";

import useManagedContent from "@/hooks/useManagedContent";

export const Testimonials = () => {
  const testimonials = useManagedContent("testimonials", CMS_DEFAULTS.testimonials);
  const siteDetails = useManagedContent("siteDetails", CMS_DEFAULTS.siteDetails);

  return (
    <section className="testimonial-system" data-testid="testimonials-section" aria-labelledby="testimonial-title">
      <div className="testimonial-system-inner">
        <SectionHeader
          kicker="Încredere verificabilă"
          title="Recenzii publicate responsabil."
          subtitle="Nu inventăm nume, ratinguri sau rezultate. Spațiile de mai jos sunt pregătite pentru feedback aprobat."
        />
        <h2 id="testimonial-title" className="sr-only">Testimoniale FireArtRo</h2>
        <div className="testimonial-system-grid">
          {testimonials.map((item, index) => (
            <Reveal key={item.id} delay={index * 0.06}>
              <article className={item.replaceable ? "is-placeholder" : ""}>
                <Quote />
                <blockquote>{item.quote}</blockquote>
                <footer>
                  <strong>{item.name}</strong>
                  <span>{item.eventType} · {item.source}</span>
                  {item.replaceable && <small>Conținut de înlocuit cu o recenzie reală</small>}
                </footer>
              </article>
            </Reveal>
          ))}
        </div>
        <div className="google-reviews-cta">
          <div>
            <span>Google Reviews</span>
            <p>Conectează profilul Google Business pentru recenzii verificabile.</p>
          </div>
          {siteDetails.googleReviewsUrl ? (
            <a href={siteDetails.googleReviewsUrl} target="_blank" rel="noopener noreferrer">
              Vezi recenziile pe Google <ArrowUpRight />
            </a>
          ) : (
            <span className="google-reviews-pending">Link Google de configurat</span>
          )}
        </div>
      </div>
    </section>
  );
};

export default Testimonials;
