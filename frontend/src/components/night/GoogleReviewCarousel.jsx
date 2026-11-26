import { ArrowUpRight, ChevronLeft, ChevronRight, Star, UserRound, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

const STARS = [1, 2, 3, 4, 5];
const dateFormat = new Intl.DateTimeFormat("ro-RO", { day: "numeric", month: "long", year: "numeric" });

function ReviewAuthor({ review }) {
  const date = review.published_at ? new Date(review.published_at) : null;
  const dateLabel = review.published_relative || (date && !Number.isNaN(date.getTime()) ? dateFormat.format(date) : "");

  return <footer className="fa-page-reviews__author">
    <span className="fa-page-reviews__avatar">
      {review.author_photo_url
        ? <img src={review.author_photo_url} alt="" width="40" height="40" loading="lazy" referrerPolicy="no-referrer" />
        : <UserRound aria-hidden="true" size={19} />}
    </span>
    <div className="fa-page-reviews__byline">
      <cite>{review.author_url ? (
        <a href={review.author_url} target="_blank" rel="noopener noreferrer">{review.author}</a>
      ) : review.author}</cite>
      {(dateLabel || review.translated) && <div className="fa-page-reviews__metadata">
        {dateLabel && <time dateTime={review.published_at}>{dateLabel}</time>}
        {review.translated && <span>Tradusă de Google</span>}
      </div>}
    </div>
  </footer>;
}

function ReviewStars({ rating }) {
  return rating >= 1 && rating <= 5 && (
    <span className="fa-page-reviews__rating" role="img" aria-label={`${rating} din 5 stele`}>
      {STARS.map(star => <Star key={star} data-filled={star <= rating} aria-hidden="true" />)}
    </span>
  );
}

function ReviewSource({ url, compact = false }) {
  return <a className="fa-page-reviews__source" href={url} target="_blank" rel="noopener noreferrer"
    aria-label="Vezi recenzia originală pe Google Maps" title={compact ? "Vezi pe Google Maps" : undefined}>
    {!compact && "Vezi la sursă"}<ArrowUpRight aria-hidden="true" />
  </a>;
}

function railGeometry(rail) {
  const max = Math.max(0, rail.scrollWidth - rail.clientWidth);
  const first = rail.children[0];
  const second = rail.children[1];
  const stride = second ? second.offsetLeft - first.offsetLeft : 0;
  const last = stride > 0 ? Math.round(max / stride) : 0;
  return { max, stride, last };
}

export default function GoogleReviewCarousel({ reviews }) {
  const [selected, setSelected] = useState(null);
  const [position, setPosition] = useState({ current: 0, last: 0 });
  const viewport = useRef(null);
  const drag = useRef(null);
  const dialog = useRef(null);
  const closeButton = useRef(null);
  const trigger = useRef(null);
  const railTitleId = useId();
  const dialogTitleId = useId();

  function updatePosition() {
    const rail = viewport.current;
    if (!rail) return;
    const { stride, last } = railGeometry(rail);
    const current = stride > 0 ? Math.min(last, Math.max(0, Math.round(rail.scrollLeft / stride))) : 0;
    setPosition(previous => previous.current === current && previous.last === last ? previous : { current, last });
  }

  useEffect(() => {
    updatePosition();
    if (typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver(updatePosition);
    observer.observe(viewport.current);
    return () => observer.disconnect();
  }, [reviews.length]);

  useEffect(() => {
    if (!selected || !dialog.current || dialog.current.open) return;
    dialog.current.showModal();
    closeButton.current?.focus({ preventScroll: true });
  }, [selected]);

  function navigateTo(index) {
    const rail = viewport.current;
    const { stride, max } = railGeometry(rail);
    rail.scrollTo({
      left: Math.max(0, Math.min(max, index * stride)),
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    });
  }

  function startDrag(event) {
    const rail = event.currentTarget;
    if (event.pointerType !== "mouse" || event.button !== 0 || !position.last || event.target.closest("a,button")) return;
    event.preventDefault();
    rail.setPointerCapture(event.pointerId);
    drag.current = { id: event.pointerId, start: event.clientX, offset: rail.scrollLeft };
  }

  function moveDrag(event) {
    if (event.pointerId === drag.current?.id) {
      event.currentTarget.scrollLeft = drag.current.offset + drag.current.start - event.clientX;
    }
  }

  function stopDrag(event) {
    if (event.pointerId === drag.current?.id) drag.current = null;
  }

  function scrollByKey(event) {
    if (event.target !== event.currentTarget || !position.last) return;
    const targets = { ArrowLeft: position.current - 1, ArrowRight: position.current + 1, Home: 0, End: position.last };
    if (!Object.hasOwn(targets, event.key)) return;
    event.preventDefault();
    navigateTo(targets[event.key]);
  }

  return (
    <div className="fa-page-reviews__carousel nr-shell">
      <h2 className="fa-page-reviews__carousel-title" id={railTitleId}>Recenzii de pe Google Maps</h2>
      <div className="fa-page-reviews__rail">
        <div ref={viewport} className="fa-page-reviews__viewport" role="region" aria-labelledby={railTitleId}
          tabIndex={position.last ? 0 : undefined} data-scrollable={position.last > 0}
          onScroll={updatePosition} onKeyDown={scrollByKey} onPointerDown={startDrag} onPointerMove={moveDrag}
          onPointerUp={stopDrag} onPointerCancel={stopDrag} onLostPointerCapture={stopDrag}>
          {reviews.map(review => <article key={review.id} className="fa-page-reviews__card" data-review-card>
            <blockquote className="fa-page-reviews__bubble">
              <ReviewStars rating={review.rating} />
              <p className="fa-page-reviews__quote">{review.text}</p>
              <div className="fa-page-reviews__actions">
                <button className="fa-page-reviews__more" type="button" aria-haspopup="dialog"
                  onClick={event => { trigger.current = event.currentTarget; setSelected(review); }}>
                  Citește mai mult
                </button>
                <ReviewSource url={review.url} compact />
              </div>
            </blockquote>
            <ReviewAuthor review={review} />
          </article>)}
        </div>
        {position.last > 0 && <>
          <button type="button" className="fa-page-reviews__arrow fa-page-reviews__arrow--prev"
            aria-label="Recenzia anterioară" disabled={position.current === 0} onClick={() => navigateTo(position.current - 1)}>
            <ChevronLeft aria-hidden="true" size={19} />
          </button>
          <button type="button" className="fa-page-reviews__arrow fa-page-reviews__arrow--next"
            aria-label="Recenzia următoare" disabled={position.current === position.last} onClick={() => navigateTo(position.current + 1)}>
            <ChevronRight aria-hidden="true" size={19} />
          </button>
        </>}
      </div>
      {position.last > 0 && <div className="fa-page-reviews__pagination" aria-label="Paginarea recenziilor">
        {Array.from({ length: position.last + 1 }, (_, index) => <button key={index} type="button"
          aria-current={index === position.current ? "true" : undefined} aria-label={`Mergi la recenzia ${index + 1}`}
          onClick={() => navigateTo(index)} />)}
      </div>}
      {selected && <dialog ref={dialog} className="fa-page-reviews__panel" aria-labelledby={dialogTitleId}
        onClose={() => { setSelected(null); trigger.current?.focus({ preventScroll: true }); }}
        onClick={event => {
          if (event.target !== event.currentTarget) return;
          const { left, right, top, bottom } = event.currentTarget.getBoundingClientRect();
          if (event.clientX < left || event.clientX > right || event.clientY < top || event.clientY > bottom) {
            event.currentTarget.close();
          }
        }}>
        <header className="fa-page-reviews__panel-head">
          <h2 id={dialogTitleId}>Recenzie de pe <span translate="no">Google Maps</span></h2>
          <button ref={closeButton} type="button" className="fa-page-reviews__panel-close" aria-label="Închide recenzia"
            onClick={() => dialog.current.close()}><X aria-hidden="true" size={20} /></button>
        </header>
        <blockquote className="fa-page-reviews__card--full" tabIndex={0}>
          <ReviewAuthor review={selected} />
          <ReviewStars rating={selected.rating} />
          <p className="fa-page-reviews__quote">{selected.text}</p>
          <ReviewSource url={selected.url} />
        </blockquote>
      </dialog>}
    </div>
  );
}
