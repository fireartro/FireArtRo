import { ArrowUpRight, Star } from "lucide-react";
import useSWR from "swr";
import { getPublicReviews } from "@/lib/reviewsApi";
import useManagedContent from "@/hooks/useManagedContent";
import { CMS_DEFAULTS } from "@/data/cmsDefaults";
import "@/styles/night-reviews.css";


const PROVIDERS = {
  facebook: {
    label: "Facebook",
    direction: "right-to-left",
    linkLabel: "Vezi recenziile pe Facebook",
  },
  google: {
    label: "Google",
    direction: "left-to-right",
    linkLabel: "Vezi recenziile pe Google",
  },
};


const reviewDate = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("ro-RO", { month: "short", year: "numeric" }).format(date);
};


function ReviewCard({ review, provider, clone = false }) {
  const date = reviewDate(review.published_at);
  const rating = Number(review.rating);
  const showRating = Number.isFinite(rating) && rating > 0 && rating <= 5;

  return (
    <blockquote {...(!clone ? { "data-review-card": true } : {})}>
      <div className="fa-page-reviews__card-top">
        <span>{provider.label}</span>
        {showRating ? (
          <span className="fa-page-reviews__rating" aria-label={`${rating} din 5 stele`}>
            <Star aria-hidden="true" />
            {rating.toLocaleString("ro-RO", { maximumFractionDigits: 1 })}
          </span>
        ) : null}
      </div>
      <p>„{review.text}”</p>
      <footer>
        <cite>{review.author || `Recenzie ${provider.label}`}</cite>
        {date ? <time dateTime={review.published_at}>{date}</time> : null}
      </footer>
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
        <span>{provider.label}</span>
        <a href={data.href} target="_blank" rel="noopener noreferrer">
          {provider.linkLabel}
          <ArrowUpRight aria-hidden="true" />
        </a>
      </div>
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
  const { data: providers = [] } = useSWR(
    settings.enabled ? "fireart-public-reviews" : null,
    () => getPublicReviews(),
    {
      dedupingInterval: 60_000,
      revalidateOnFocus: false,
      shouldRetryOnError: false,
    },
  );

  const visibleProviders = providers.filter(provider =>
    (provider.id === "google" && settings.googleEnabled)
    || (provider.id === "facebook" && settings.facebookEnabled));
  if (!settings.enabled || !visibleProviders.length) return null;

  return (
    <section
      className="fa-page-reviews"
      data-testid="home-reviews"
      aria-label="Recenzii publice verificate"
    >
      <p className="fa-kicker">{settings.heading}</p>
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
