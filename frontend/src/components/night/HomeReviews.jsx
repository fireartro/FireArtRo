import { ArrowUpRight, Star } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { getPublicReviews } from "@/lib/reviewsApi";
import useManagedContent from "@/hooks/useManagedContent";
import useNearViewport from "@/hooks/useNearViewport";
import { CMS_DEFAULTS } from "@/data/cmsDefaults";
import "@/styles/night-reviews.css";


const PROVIDERS = {
  facebook: {
    label: "Facebook",
    direction: "right-to-left",
    linkLabel: "Vezi recenziile pe Facebook",
  },
  google: {
    label: "Google Maps",
    direction: "left-to-right",
    linkLabel: "Vezi recenziile pe Google Maps",
  },
};


const reviewDate = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("ro-RO", { month: "short", year: "numeric" }).format(date);
};


function ReviewCard({ review, provider, clone = false }) {
  const date = review.published_relative || reviewDate(review.published_at);
  const rating = Number(review.rating);
  const showRating = Number.isFinite(rating) && rating > 0 && rating <= 5;

  return (
    <blockquote {...(!clone ? { "data-review-card": true } : {})}>
      <div className="fa-page-reviews__card-top">
        <span className={review.provider === "google" || provider.label === "Google Maps" ? "fa-page-reviews__google-text" : undefined} translate="no">{provider.label}</span>
        {showRating ? (
          <span className="fa-page-reviews__rating" aria-label={`${rating} din 5 stele`}>
            <Star aria-hidden="true" />
            {rating.toLocaleString("ro-RO", { maximumFractionDigits: 1 })}
          </span>
        ) : null}
      </div>
      <p>„{review.text}”</p>
      {review.translated ? <small className="fa-page-reviews__translation-note">Text tradus automat de Google Maps.</small> : null}
      <footer>
        <span className="fa-page-reviews__author">
          {review.author_photo_url ? <img src={review.author_photo_url} alt="" width="32" height="32" loading="lazy" referrerPolicy="no-referrer" /> : null}
          <cite>{review.author_url ? (
            <a href={review.author_url} target="_blank" rel="noopener noreferrer" tabIndex={clone ? -1 : undefined}>
              {review.author || `Autor ${provider.label}`}
            </a>
          ) : review.author || `Recenzie ${provider.label}`}</cite>
        </span>
        {date ? <time dateTime={review.published_at}>{date}</time> : null}
      </footer>
      {review.url ? <a className="fa-page-reviews__source" href={review.url} target="_blank" rel="noopener noreferrer" tabIndex={clone ? -1 : undefined} aria-label="Vezi recenzia originală pe Google Maps">
        Vezi recenzia <ArrowUpRight aria-hidden="true" />
      </a> : null}
    </blockquote>
  );
}


function ReviewGroup({ reviews, provider, clone = false }) {
  return (
    <div className="fa-page-reviews__group" {...(clone ? { "aria-hidden": "true" } : {})}>
      {reviews.map((review) => (
        <ReviewCard
          clone={clone}
          key={`${provider.label}-${review.id}`}
          provider={provider}
          review={review}
        />
      ))}
    </div>
  );
}


function ReviewRail({ data }) {
  const provider = PROVIDERS[data.id];
  if (!provider || !data.reviews.length || !data.href) return null;

  return (
    <div
      className="fa-page-reviews__lane"
      data-review-provider={data.id}
      data-direction={provider.direction}
    >
      <div className="fa-page-reviews__lane-head nr-shell">
        {data.id === "google" ? (
          <img className="fa-page-reviews__google-logo" src="/media/brand/google-maps-white.svg" alt="Google Maps" />
        ) : <span>{provider.label}</span>}
        <a href={data.href} target="_blank" rel="noopener noreferrer">
          {provider.linkLabel}
          <ArrowUpRight aria-hidden="true" />
        </a>
      </div>
      {data.id === "google" ? <p className="fa-page-reviews__notice nr-shell">
        Recenzii cu text, în ordinea de relevanță furnizată de Google Maps. Afișăm până la {data.reviews.length} recenzii, fără filtrare după notă.
      </p> : null}
      <div className="fa-page-reviews__viewport">
        <div className="fa-page-reviews__track">
          <ReviewGroup reviews={data.reviews} provider={provider} />
          <ReviewGroup clone reviews={data.reviews} provider={provider} />
        </div>
      </div>
    </div>
  );
}


export default function HomeReviews() {
  const settings = useManagedContent("reviewSettings", CMS_DEFAULTS.reviewSettings);
  const anchor = useRef(null);
  const near = useNearViewport(anchor, "300px");
  const [providers, setProviders] = useState([]);
  const enabled = settings.enabled && (settings.googleEnabled || settings.facebookEnabled);
  useEffect(() => {
    if (!enabled || !near) return undefined;
    const controller = new AbortController();
    getPublicReviews({ signal: controller.signal }).then(result => {
      if (!controller.signal.aborted) setProviders(result);
    });
    return () => controller.abort();
  }, [enabled, near]);

  const visibleProviders = providers.filter(provider =>
    (provider.id === "google" && settings.googleEnabled)
    || (provider.id === "facebook" && settings.facebookEnabled));
  if (!enabled) return null;
  // Keep no cross-page Places content cache; fetch only when this area approaches view.
  if (!visibleProviders.length) return <div ref={anchor} aria-hidden="true" />;

  const heading = settings.heading === "Recenzii verificate" ? "Recenziile clienților" : settings.heading;

  return (
    <section
      className="fa-page-reviews"
      data-testid="home-reviews"
      ref={anchor}
      aria-label="Recenziile clienților"
    >
      <p className="fa-kicker">{heading}</p>
      {settings.description ? <p>{settings.description}</p> : null}
      {visibleProviders.map((provider) => (
        <ReviewRail
          data={{ ...provider, reviews: provider.reviews.slice(0, settings.maxItems) }}
          key={provider.id}
        />
      ))}
    </section>
  );
}
