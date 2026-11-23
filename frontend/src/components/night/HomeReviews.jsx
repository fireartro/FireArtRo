import { ArrowUpRight, Star } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { getPublicReviews } from "@/lib/reviewsApi";
import { OPEN_COOKIE_SETTINGS_EVENT, useCookieConsent } from "@/lib/cookieConsent";
import { allowedGoogleMedia } from "@/lib/optionalGoogleMedia";
import useManagedContent from "@/hooks/useManagedContent";
import useNearViewport from "@/hooks/useNearViewport";
import { CMS_DEFAULTS } from "@/data/cmsDefaults";
import FacebookReviewFrame from "./FacebookReviewFrame";
import "@/styles/night-reviews.css";

const FACEBOOK_REVIEWS_URL = "https://www.facebook.com/FireArtRo/reviews";

const PROVIDERS = {
  facebook: {
    label: "Facebook",
    direction: "right-to-left",
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
      {review.url ? <a className="fa-page-reviews__source" href={review.url} target="_blank" rel="noopener noreferrer" tabIndex={clone ? -1 : undefined} aria-label={`Vezi recenzia originală pe ${provider.label}`}>
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


function FacebookReviewLink() {
  return (
    <a className="fa-page-reviews__add-review" href={FACEBOOK_REVIEWS_URL} target="_blank"
      rel="noopener noreferrer" aria-label="Adaugă recenzie pe Facebook (se deschide într-o filă nouă)">
      Adaugă recenzie
      <ArrowUpRight aria-hidden="true" />
    </a>
  );
}


function ReviewRail({ data, marketingAllowed }) {
  const provider = PROVIDERS[data.id];
  if (!provider || !data.reviews.length || !data.href) return null;
  const isGoogle = data.id === "google";
  const reviews = isGoogle
    ? (marketingAllowed ? data.reviews.filter(review => review.author && review.url) : [])
    : data.reviews.map(review => ({
      ...review, author_photo_url: allowedGoogleMedia(review.author_photo_url, marketingAllowed),
    }));

  return (
    <div
      className="fa-page-reviews__lane"
      data-review-provider={data.id}
      data-direction={provider.direction}
    >
      <div className="fa-page-reviews__lane-head nr-shell">
        {isGoogle ? (
          <img className="fa-page-reviews__google-logo" src="/media/brand/google-maps-white.svg" alt="Google Maps" />
        ) : <span>{provider.label}</span>}
        {isGoogle ? (
          <a href={data.href} target="_blank" rel="noopener noreferrer">
            {provider.linkLabel}
            <ArrowUpRight aria-hidden="true" />
          </a>
        ) : <FacebookReviewLink />}
      </div>
      {isGoogle && !marketingAllowed && <p className="fa-page-reviews__notice nr-shell">
        Pentru a afișa aici recenziile și fotografiile autorilor de pe Google Maps, poți <button type="button" className="fa-page-reviews__notice-link"
          onClick={() => window.dispatchEvent(new Event(OPEN_COOKIE_SETTINGS_EVENT))}>permite conținutul extern</button>.
      </p>}
      {isGoogle && reviews.length > 0 && <p className="fa-page-reviews__notice nr-shell">
        Afișăm {reviews.length} recenzii cu text și link la sursă, în ordinea de relevanță furnizată de Google Maps, fără filtrare după notă.{' '}
        <a className="fa-page-reviews__notice-link" href="https://support.google.com/contributionpolicy/answer/7422880?hl=ro" target="_blank" rel="noopener noreferrer">Politica Google Maps privind recenziile</a>.
      </p>}
      {reviews.length > 0 && <div className="fa-page-reviews__viewport">
        <div className="fa-page-reviews__track">
          <ReviewGroup reviews={reviews} provider={provider} />
          <ReviewGroup clone reviews={reviews} provider={provider} />
        </div>
      </div>}
    </div>
  );
}


function FacebookReviewWidget({ marketingAllowed, near }) {
  return (
    <div className="fa-page-reviews__lane" data-review-provider="facebook">
      <div className="fa-page-reviews__lane-head nr-shell">
        <span>Facebook</span>
        <FacebookReviewLink />
      </div>
      {marketingAllowed ? near && (
        <FacebookReviewFrame />
      ) : (
        <p className="fa-page-reviews__notice nr-shell">
          Pentru a afișa aici recenziile Facebook prin Elfsight, poți{" "}
          <button type="button" className="fa-page-reviews__notice-link"
            onClick={() => window.dispatchEvent(new Event(OPEN_COOKIE_SETTINGS_EVENT))}>
            permite conținutul extern
          </button>.
        </p>
      )}
    </div>
  );
}

export default function HomeReviews({ showFacebookWidget = false }) {
  const settings = useManagedContent("reviewSettings", CMS_DEFAULTS.reviewSettings);
  const marketingAllowed = useCookieConsent()?.marketing === true;
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
  const hasFacebookWidget = showFacebookWidget && settings.facebookEnabled
    && !visibleProviders.some(provider => provider.id === "facebook");
  if (!enabled) return null;
  // Keep no cross-page Places content cache; fetch only when this area approaches view.
  if (!hasFacebookWidget && !visibleProviders.length) return <div ref={anchor} aria-hidden="true" />;

  const heading = settings.heading?.trim().toLowerCase() === "recenzii verificate"
    ? "Recenzii publicate online" : settings.heading;

  return (
    <section
      className="fa-page-reviews"
      data-testid="home-reviews"
      id="recenzii"
      ref={anchor}
      aria-label="Recenzii publicate online"
    >
      <p className="fa-kicker">{heading}</p>
      {settings.description ? <p>{settings.description}</p> : null}
      <p className="fa-page-reviews__notice nr-shell">Recenziile sunt publicate pe platformele indicate. FireArtRo nu verifică independent dacă autorii au cumpărat sau folosit serviciile.</p>
      {hasFacebookWidget && <FacebookReviewWidget marketingAllowed={marketingAllowed} near={near} />}
      {visibleProviders.map((provider) => (
        <ReviewRail
          data={{ ...provider, reviews: provider.reviews.slice(0, settings.maxItems) }}
          marketingAllowed={marketingAllowed}
          key={provider.id}
        />
      ))}
    </section>
  );
}
