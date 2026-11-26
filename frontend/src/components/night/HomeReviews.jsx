import { ArrowUpRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { getPublicReviews } from "@/lib/reviewsApi";
import { OPEN_COOKIE_SETTINGS_EVENT, useCookieConsent } from "@/lib/cookieConsent";
import { useManagedContentSnapshot } from "@/content/ManagedContentProvider";
import useManagedContent from "@/hooks/useManagedContent";
import useNearViewport from "@/hooks/useNearViewport";
import { CMS_DEFAULTS } from "@/data/cmsDefaults";
import { REVIEW_POLICY_HREF } from "@/data/legalContent";
import FacebookReviewFrame from "./FacebookReviewFrame";
import GoogleReviewCarousel from "./GoogleReviewCarousel";
import "@/styles/night-reviews.css";

const FACEBOOK_REVIEWS_URL = "https://www.facebook.com/FireArtRo/reviews";

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


function GoogleReviewRail({ data, marketingAllowed, maxItems }) {
  const reviews = marketingAllowed
    ? data.reviews.slice(0, maxItems).filter(review => review.author && review.url)
    : [];
  return (
    <div
      className="fa-page-reviews__lane"
      data-review-provider="google"
    >
      <div className="fa-page-reviews__lane-head nr-shell">
        <img className="fa-page-reviews__google-logo" src="/media/brand/google-maps-white.svg" alt="Google Maps" />
        <ReviewPlatformLink googleHref={data.href} />
      </div>
      {!marketingAllowed && <p className="fa-page-reviews__notice nr-shell">
        Pentru a afișa aici recenziile și fotografiile autorilor de pe Google Maps, poți <button type="button" className="fa-page-reviews__notice-link"
          onClick={() => window.dispatchEvent(new Event(OPEN_COOKIE_SETTINGS_EVENT))}>permite conținutul extern</button>.
      </p>}
      {reviews.length > 0 && <GoogleReviewCarousel reviews={reviews} />}
      {reviews.length > 0 && <p className="fa-page-reviews__notice fa-page-reviews__sorting nr-shell">
        Afișăm {reviews.length === 1 ? "o recenzie" : `${reviews.length} recenzii`} cu text și link la sursă, în ordinea de relevanță furnizată de Google Maps, fără filtrare după notă.{' '}
        <a className="fa-page-reviews__notice-link" href="https://support.google.com/contributionpolicy/answer/7422880?hl=ro" target="_blank" rel="noopener noreferrer">Politica Google Maps privind recenziile</a>.
      </p>}
    </div>
  );
}


function FacebookReviewWidget({ marketingAllowed }) {
  return (
    <div className="fa-page-reviews__lane" data-review-provider="facebook">
      <div className="fa-page-reviews__lane-head nr-shell">
        <span>Facebook</span>
        <ReviewPlatformLink />
      </div>
      {marketingAllowed ? (
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
  const googleEnabled = settings.enabled && settings.googleEnabled && !preview;
  const near = useNearViewport(anchor, "300px", googleEnabled);
  const [providers, setProviders] = useState([]);
  useEffect(() => {
    if (!googleEnabled || !near) return undefined;
    const controller = new AbortController();
    getPublicReviews({ signal: controller.signal }).then(result => {
      if (!controller.signal.aborted) setProviders(result);
    });
    return () => controller.abort();
  }, [googleEnabled, near]);

  const google = googleEnabled && providers.find(provider => provider.id === "google");
  if (!enabled) return null;
  // Keep no cross-page Places content cache; fetch only when this area approaches view.
  if (!preview && !settings.facebookEnabled && !google) return <div ref={anchor} aria-hidden="true" />;

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
        Surse active în draft — {[settings.googleEnabled && "Google", settings.facebookEnabled && "Facebook"].filter(Boolean).join(", ")}.
        Verifică Google Places în Admin, în Recenzii. Widgetul Facebook se verifică pe site după acordul pentru Conținut extern.
      </p>}
      {!preview && settings.facebookEnabled && <FacebookReviewWidget marketingAllowed={marketingAllowed} />}
      {google && (
        <GoogleReviewRail
          data={google}
          marketingAllowed={marketingAllowed}
          maxItems={settings.maxItems}
        />
      )}
    </section>
  );
}
