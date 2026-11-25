import { ArrowUpRight, Star, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { getPublicReviews } from "@/lib/reviewsApi";
import { OPEN_COOKIE_SETTINGS_EVENT, useCookieConsent } from "@/lib/cookieConsent";
import { useManagedContentSnapshot } from "@/content/ManagedContentProvider";
import { allowedGoogleMedia } from "@/lib/optionalGoogleMedia";
import useManagedContent from "@/hooks/useManagedContent";
import useNearViewport from "@/hooks/useNearViewport";
import { CMS_DEFAULTS } from "@/data/cmsDefaults";
import { REVIEW_POLICY_HREF } from "@/data/legalContent";
import FacebookReviewFrame from "./FacebookReviewFrame";
import "@/styles/night-reviews.css";

const FACEBOOK_REVIEWS_URL = "https://www.facebook.com/FireArtRo/reviews";

const PROVIDERS = {
  facebook: {
    label: "Facebook",
  },
  google: {
    label: "Google Maps",
  },
};


const reviewDate = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("ro-RO", { month: "short", year: "numeric" }).format(date);
};


function ReviewCard({ review, provider, onExpand }) {
  const date = review.published_relative || reviewDate(review.published_at);
  const rating = Number(review.rating);
  const showRating = Number.isFinite(rating) && rating > 0 && rating <= 5;

  return (
    <blockquote className={onExpand ? "fa-page-reviews__card" : "fa-page-reviews__card fa-page-reviews__card--full"}
      {...(onExpand ? { "data-review-card": true } : { tabIndex: 0 })}>
      <div className="fa-page-reviews__card-top">
        <span className={review.provider === "google" || provider.label === "Google Maps" ? "fa-page-reviews__google-text" : undefined} translate="no">{provider.label}</span>
        {showRating ? (
          <span className="fa-page-reviews__rating" aria-label={`${rating} din 5 stele`}>
            <Star aria-hidden="true" />
            {rating.toLocaleString("ro-RO", { maximumFractionDigits: 1 })}
          </span>
        ) : null}
      </div>
      <p className="fa-page-reviews__quote">„{review.text}”</p>
      {review.translated ? <small className="fa-page-reviews__translation-note">Text tradus automat de Google Maps.</small> : null}
      <footer>
        <span className="fa-page-reviews__author">
          {review.author_photo_url ? <img src={review.author_photo_url} alt="" width="32" height="32" loading="lazy" referrerPolicy="no-referrer" /> : null}
          <cite>{review.author_url ? (
            <a href={review.author_url} target="_blank" rel="noopener noreferrer">
              {review.author || `Autor ${provider.label}`}
            </a>
          ) : review.author || `Recenzie ${provider.label}`}</cite>
        </span>
        {date ? <time dateTime={review.published_at}>{date}</time> : null}
      </footer>
      {(onExpand || review.url) && <div className="fa-page-reviews__actions">
        {onExpand && <button className="fa-page-reviews__more" type="button" aria-haspopup="dialog"
          onClick={event => onExpand(review, event.currentTarget)}>
          Citește mai mult
        </button>}
        {review.url && <a className="fa-page-reviews__source" href={review.url} target="_blank" rel="noopener noreferrer"
          aria-label={`Vezi recenzia originală pe ${provider.label}`}>
          Vezi la sursă <ArrowUpRight aria-hidden="true" />
        </a>}
      </div>}
    </blockquote>
  );
}


function ReviewCarousel({ reviews, provider }) {
  const [selected, setSelected] = useState(null);
  const dialog = useRef(null);
  const closeButton = useRef(null);
  const trigger = useRef(null);
  const titleId = useId();

  useEffect(() => {
    if (!selected || !dialog.current || dialog.current.open) return;
    dialog.current.showModal();
    closeButton.current?.focus({ preventScroll: true });
  }, [selected]);

  function openReview(review, button) {
    trigger.current = button;
    setSelected(review);
  }

  function clearSelection() {
    setSelected(null);
    trigger.current?.focus({ preventScroll: true });
  }

  return (
    <>
      <div className="fa-page-reviews__viewport nr-shell">
        <div className="fa-page-reviews__track">
          <div className="fa-page-reviews__group">
            {reviews.map(review => (
              <ReviewCard key={review.id} provider={provider} review={review} onExpand={openReview} />
            ))}
          </div>
        </div>
      </div>
      {selected && <dialog ref={dialog} className="fa-page-reviews__panel" aria-labelledby={titleId}
        onClose={clearSelection}
        onClick={event => {
          if (event.target !== event.currentTarget) return;
          const { left, right, top, bottom } = event.currentTarget.getBoundingClientRect();
          if (event.clientX < left || event.clientX > right || event.clientY < top || event.clientY > bottom) {
            event.currentTarget.close();
          }
        }}>
        <header className="fa-page-reviews__panel-head">
          <h2 id={titleId}>Recenzie de pe <span translate="no">{provider.label}</span></h2>
          <button ref={closeButton} type="button" className="fa-page-reviews__panel-close" aria-label="Închide recenzia"
            onClick={() => dialog.current.close()}><X aria-hidden="true" /></button>
        </header>
        <ReviewCard provider={provider} review={selected} />
      </dialog>}
    </>
  );
}


function ReviewPlatformLink({ googleHref }) {
  const label = googleHref ? "Vezi pe Google Maps" : "Adaugă recenzie";
  return (
    <a className="fa-page-reviews__add-review" href={googleHref || FACEBOOK_REVIEWS_URL} target="_blank"
      rel="noopener noreferrer"
      aria-label={`${googleHref ? label : "Adaugă recenzie pe Facebook"} (se deschide într-o filă nouă)`}>
      {label}
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
    >
      <div className="fa-page-reviews__lane-head nr-shell">
        {isGoogle ? (
          <img className="fa-page-reviews__google-logo" src="/media/brand/google-maps-white.svg" alt="Google Maps" />
        ) : <span>{provider.label}</span>}
        <ReviewPlatformLink googleHref={isGoogle ? data.href : undefined} />
      </div>
      {isGoogle && !marketingAllowed && <p className="fa-page-reviews__notice nr-shell">
        Pentru a afișa aici recenziile și fotografiile autorilor de pe Google Maps, poți <button type="button" className="fa-page-reviews__notice-link"
          onClick={() => window.dispatchEvent(new Event(OPEN_COOKIE_SETTINGS_EVENT))}>permite conținutul extern</button>.
      </p>}
      {isGoogle && reviews.length > 0 && <p className="fa-page-reviews__notice nr-shell">
        Afișăm {reviews.length === 1 ? "o recenzie" : `${reviews.length} recenzii`} cu text și link la sursă, în ordinea de relevanță furnizată de Google Maps, fără filtrare după notă.{' '}
        <a className="fa-page-reviews__notice-link" href="https://support.google.com/contributionpolicy/answer/7422880?hl=ro" target="_blank" rel="noopener noreferrer">Politica Google Maps privind recenziile</a>.
      </p>}
      {reviews.length > 0 && <ReviewCarousel reviews={reviews} provider={provider} />}
    </div>
  );
}


function FacebookReviewWidget({ marketingAllowed, near }) {
  return (
    <div className="fa-page-reviews__lane" data-review-provider="facebook">
      <div className="fa-page-reviews__lane-head nr-shell">
        <span>Facebook</span>
        <ReviewPlatformLink />
      </div>
      {marketingAllowed ? near && (
        <FacebookReviewFrame reviewsHref={FACEBOOK_REVIEWS_URL} />
      ) : (
        <p className="fa-page-reviews__notice nr-shell">
          Pentru a afișa aici recenziile Facebook prin Elfsight, poți{" "}
          <button type="button" className="fa-page-reviews__notice-link"
            onClick={() => window.dispatchEvent(new Event(OPEN_COOKIE_SETTINGS_EVENT))}>
            permite conținutul extern
          </button>.{" "}
          <a className="fa-page-reviews__notice-link" href={FACEBOOK_REVIEWS_URL} target="_blank" rel="noopener noreferrer">
            Vezi recenziile pe Facebook
          </a>
        </p>
      )}
    </div>
  );
}

export default function HomeReviews() {
  const settings = useManagedContent("reviewSettings", CMS_DEFAULTS.reviewSettings);
  const { preview } = useManagedContentSnapshot();
  const marketingAllowed = useCookieConsent()?.marketing === true;
  const anchor = useRef(null);
  const enabled = settings.enabled && (settings.googleEnabled || settings.facebookEnabled);
  const near = useNearViewport(anchor, "300px", enabled && !preview);
  const facebookNear = useNearViewport(anchor, "0px 0px 1200px",
    enabled && !preview && settings.facebookEnabled && marketingAllowed);
  const [providers, setProviders] = useState([]);
  useEffect(() => {
    if (preview || !enabled || !near) return undefined;
    const controller = new AbortController();
    getPublicReviews({ signal: controller.signal }).then(result => {
      if (!controller.signal.aborted) setProviders(result);
    });
    return () => controller.abort();
  }, [enabled, near, preview]);

  const visibleProviders = providers.filter(provider =>
    (provider.id === "google" && settings.googleEnabled)
    || (provider.id === "facebook" && settings.facebookEnabled));
  const hasFacebookWidget = settings.facebookEnabled
    && !visibleProviders.some(provider => provider.id === "facebook");
  if (!enabled) return null;
  // Keep no cross-page Places content cache; fetch only when this area approaches view.
  if (!preview && !hasFacebookWidget && !visibleProviders.length) return <div ref={anchor} aria-hidden="true" />;

  const heading = settings.heading;

  return (
    <section
      className="fa-page-reviews"
      data-testid="home-reviews"
      id="recenzii"
      ref={anchor}
      aria-label={heading}
    >
      <div className="fa-page-reviews__intro nr-shell">
        <p className="fa-kicker">{heading}</p>
        <a className="fa-page-reviews__notice-link" href={REVIEW_POLICY_HREF}>Sursă și verificare</a>
        {settings.description ? <p className="fa-page-reviews__notice">{settings.description}</p> : null}
      </div>
      {preview && <p className="fa-page-reviews__notice nr-shell">
        Surse activate în draft: {[settings.googleEnabled && "Google", settings.facebookEnabled && "Facebook"].filter(Boolean).join(", ")}.
        Disponibilitatea recenziilor se verifică în Admin, în Recenzii.
      </p>}
      {!preview && hasFacebookWidget && <FacebookReviewWidget marketingAllowed={marketingAllowed} near={facebookNear} />}
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
