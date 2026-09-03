import { CMS_DEFAULTS } from "@/data/cmsDefaults";
import { useEffect, useMemo, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { ArrowUpRight, ExternalLink, Play } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { PACKAGE_CATEGORIES } from "@/data/businessContent";
import { MEDIA } from "@/data/content";
import useManagedContent from "@/hooks/useManagedContent";
import { goToContact } from "@/lib/contactNavigation";
import ManagedPageMedia from "@/components/site/ManagedPageMedia";

const visualByCategory = {
  "Artificii de zi": MEDIA.corporate,
  "Artificii de noapte": MEDIA.fireworksSky,
  "Show drone": MEDIA.droneShow,
  "Drone + artificii": MEDIA.hybrid,
  "Efecte speciale": MEDIA.coldSparks,
  "Corporate / Festival": MEDIA.crowd,
};

const DRONE_REQUEST_CATEGORY = "Show drone";

const packageConfiguration = (item) => {
  if (item.droneCount && item.effectsCount) return `${item.droneCount} drone + ${item.effectsCount} grupe de efecte`;
  if (item.droneCount) return `${item.droneCount} drone`;
  if (item.effectsCount) return `${item.effectsCount} grupe de efecte`;
  if (item.category === "Artificii de zi") return "Pachet pirotehnic de zi";
  if (item.category === "Artificii de noapte") return "Pachet pirotehnic de noapte";
  if (item.category === "Efecte speciale") return "Configurație mixtă";
  return "După brief";
};

const getYouTubeId = (value = "") => {
  try {
    const url = new URL(value);
    if (url.hostname === "youtu.be") return url.pathname.split("/").filter(Boolean)[0] || "";
    if (url.hostname.endsWith("youtube.com")) {
      if (url.pathname === "/watch") return url.searchParams.get("v") || "";
      const segments = url.pathname.split("/").filter(Boolean);
      if (["embed", "shorts", "live"].includes(segments[0])) return segments[1] || "";
    }
  } catch {
    return "";
  }
  return "";
};

const getYouTubeEmbedUrl = (value) => {
  const id = getYouTubeId(value);
  return id
    ? `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&playsinline=1`
    : "";
};

const getYouTubeThumbnailUrl = (value) => {
  const id = getYouTubeId(value);
  return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : "";
};

const getPackageVisual = (item, mediaById) => (
  mediaById?.get(item?.imageMediaId)?.src
  || getYouTubeThumbnailUrl(item?.videoUrl?.trim())
  || visualByCategory[item?.category]
  || MEDIA.fireworksSky
);

export const Packages = ({ items }) => {
  const copy = useManagedContent("packagesPage", CMS_DEFAULTS.packagesPage);
  const mediaItems = useManagedContent("mediaItems", CMS_DEFAULTS.mediaItems);
  const mediaById = useMemo(() => new Map(mediaItems.map((item) => [item.id, item])), [mediaItems]);
  const managedPackages = useManagedContent("packages", CMS_DEFAULTS.packages);
  const packages = Array.isArray(items) ? items : managedPackages;
  const categories = useMemo(
    () => PACKAGE_CATEGORIES.filter(
      (category) => (
        category !== "Toate"
        && (category === DRONE_REQUEST_CATEGORY || packages.some((item) => item.category === category))
      ),
    ),
    [packages],
  );
  const initialCategory = categories.includes("Drone + artificii") ? "Drone + artificii" : categories[0];
  const initialPackage = packages.find((item) => item.category === initialCategory) || packages[0];
  const [category, setCategory] = useState(initialCategory);
  const [selectedId, setSelectedId] = useState(initialPackage?.id || "");
  const [displayedId, setDisplayedId] = useState(initialPackage?.id || "");
  const [transitionState, setTransitionState] = useState("idle");
  const [videoPackageId, setVideoPackageId] = useState("");
  const variantRefs = useRef([]);
  const timersRef = useRef([]);
  const reduceMotion = useReducedMotion();

  const variants = useMemo(
    () => packages.filter((item) => item.category === category),
    [category, packages],
  );
  const isDroneShowCategory = category === DRONE_REQUEST_CATEGORY;
  const hasPackageVariants = variants.length > 0;
  const activePackage = packages.find((item) => item.id === displayedId) || variants[0] || packages[0];
  const primaryVideoUrl = activePackage?.videoUrl?.trim() || "";
  const videoEmbedUrl = getYouTubeEmbedUrl(primaryVideoUrl);
  const packageThumbnail = getPackageVisual(activePackage, mediaById);
  const additionalVideos = Array.isArray(activePackage?.moreVideoUrls)
    ? activePackage.moreVideoUrls.filter(Boolean)
    : [];
  const isVideoOpen = Boolean(primaryVideoUrl) && videoPackageId === activePackage?.id;

  useEffect(() => () => timersRef.current.forEach(window.clearTimeout), []);

  useEffect(() => {
    const nextCategory = categories.includes(category) ? category : categories[0];
    const nextVariants = packages.filter((item) => item.category === nextCategory);
    if (nextCategory !== category) setCategory(nextCategory);
    if (!nextVariants.some((item) => item.id === selectedId)) {
      timersRef.current.forEach(window.clearTimeout);
      setSelectedId(nextVariants[0]?.id || "");
      setDisplayedId(nextVariants[0]?.id || "");
      setTransitionState("idle");
      setVideoPackageId("");
    }
  }, [categories, category, packages, selectedId]);

  const swapPackage = (nextPackage) => {
    if (!nextPackage || nextPackage.id === selectedId) return;
    setVideoPackageId("");
    setSelectedId(nextPackage.id);
    timersRef.current.forEach(window.clearTimeout);
    timersRef.current = [];

    if (reduceMotion) {
      setDisplayedId(nextPackage.id);
      setTransitionState("idle");
      return;
    }

    setTransitionState("swap");
    timersRef.current.push(window.setTimeout(() => setDisplayedId(nextPackage.id), 150));
    timersRef.current.push(window.setTimeout(() => setTransitionState("idle"), 430));
  };

  const changeCategory = (nextCategory) => {
    const first = packages.find((item) => item.category === nextCategory);
    setCategory(nextCategory);
    if (!first) return;
    if (first.id === selectedId) {
      setDisplayedId(first.id);
      return;
    }
    swapPackage(first);
  };

  const chooseVariant = (index, focus = false) => {
    const next = variants[index];
    swapPackage(next);
    if (focus) window.requestAnimationFrame(() => variantRefs.current[index]?.focus());
  };

  const handleVariantKeyDown = (event, index) => {
    let nextIndex = null;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") nextIndex = (index + 1) % variants.length;
    if (event.key === "ArrowLeft" || event.key === "ArrowUp") nextIndex = (index - 1 + variants.length) % variants.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = variants.length - 1;
    if (nextIndex === null) return;
    event.preventDefault();
    chooseVariant(nextIndex, true);
  };

  const requestPackage = () => {
    if (!activePackage) return;
    if (activePackage.ctaHref && activePackage.ctaHref !== "/contact") {
      window.location.assign(activePackage.ctaHref);
      return;
    }
    goToContact({
      package_id: activePackage.id,
      package_title: activePackage.title,
      services: [activePackage.category],
    });
  };

  const requestDroneQuote = () => {
    goToContact({ services: [DRONE_REQUEST_CATEGORY] });
  };

  return (
    <section className="nr-package-comparator" data-testid="package-comparator" aria-labelledby="packages-title">
      <div className="nr-shell nr-package-comparator__shell">
        <header className="nr-package-comparator__header">
          <div>
            <p>{copy.eyebrow}</p>
            <h1 id="packages-title">{copy.title}</h1>
          </div>
          <p>{copy.description}</p>
        </header>
        <ManagedPageMedia mediaId={copy.heroMediaId} />

        <nav className="nr-package-categories" role="tablist" aria-label="Categorii de spectacol">
          {categories.map((item) => (
            <button
              key={item}
              type="button"
              role="tab"
              aria-selected={category === item}
              className={category === item ? "is-active" : ""}
              onClick={() => changeCategory(item)}
            >
              {item}
            </button>
          ))}
        </nav>

        {hasPackageVariants && (
          <>
            <div
              className="nr-package-variant-strip"
              data-testid="package-variant-strip"
              role="tablist"
              aria-label={`Variante pentru ${category}`}
            >
              {variants.map((item, index) => (
                <button
                  key={item.id}
                  ref={(node) => { variantRefs.current[index] = node; }}
                  type="button"
                  role="tab"
                  data-variant-tile
                  aria-selected={item.id === selectedId}
                  tabIndex={item.id === selectedId ? 0 : -1}
                  className={item.id === selectedId ? "is-active" : ""}
                  onClick={() => chooseVariant(index)}
                  onKeyDown={(event) => handleVariantKeyDown(event, index)}
                >
                  <span className="nr-package-variant-strip__index">{String(index + 1).padStart(2, "0")}</span>
                  <span className="nr-package-variant-strip__copy">
                    <small>{item.category}</small>
                    <strong>{item.title}</strong>
                  </span>
                  <ArrowUpRight aria-hidden="true" />
                </button>
              ))}
            </div>

            <article
              className="nr-package-stage"
              data-testid="package-stage"
              data-transition-state={transitionState}
              aria-live="polite"
            >
              <div className="nr-package-stage__main">
                <figure className="nr-package-stage__media" data-testid="package-media">
                  <img
                    key={activePackage.id}
                    src={packageThumbnail}
                    alt={`Previzualizare pentru ${activePackage.title}`}
                    loading="eager"
                    decoding="async"
                  />
                  {primaryVideoUrl && (
                    <button
                      type="button"
                      className="nr-package-video-trigger"
                      onClick={() => setVideoPackageId(activePackage.id)}
                      aria-label={`Vezi videoclipul pachetului ${activePackage.title}`}
                    >
                      <Play aria-hidden="true" fill="currentColor" />
                      <span>Vezi clipul</span>
                    </button>
                  )}
                  <figcaption>{activePackage.category}</figcaption>
                </figure>

                <div className="nr-package-stage__content">
                  <div className="nr-package-stage__copy">
                    <p>{activePackage.badge || activePackage.visualImpact}</p>
                    <h2 data-testid="packages-active-title">{activePackage.title}</h2>
                    <span>{activePackage.shortDescription}</span>
                    {Array.isArray(activePackage.highlights) && activePackage.highlights.length > 0 && (
                      <ul className="nr-package-highlights" aria-label="Caracteristici incluse">
                        {activePackage.highlights.slice(0, 3).map((item) => <li key={item}>{item}</li>)}
                      </ul>
                    )}
                  </div>

                  <div className="nr-package-stage__decision">
                    <dl className="nr-package-stage__facts">
                      <div><dt>Pentru</dt><dd>{activePackage.bestFor}</dd></div>
                      <div><dt>Durată</dt><dd>{activePackage.duration || "După brief"}</dd></div>
                      <div><dt>Format</dt><dd>{packageConfiguration(activePackage)}</dd></div>
                    </dl>

                    {activePackage.bonus && <p className="nr-package-bonus"><strong>Inclus:</strong> {activePackage.bonus}</p>}
                    {activePackage.videoNote && <p className="nr-package-video-note">{activePackage.videoNote}</p>}

                    {additionalVideos.length > 0 && (
                      <details className="nr-package-more-videos">
                        <summary>Alte videoclipuri ({additionalVideos.length})</summary>
                        <div>
                          {additionalVideos.map((url, index) => (
                            <a key={`${url}-${index}`} href={url} target="_blank" rel="noopener noreferrer">
                              Video {index + 2} <ExternalLink aria-hidden="true" />
                            </a>
                          ))}
                        </div>
                      </details>
                    )}

                    <button
                      type="button"
                      className="nr-package-request"
                      data-testid="packages-direct-cta"
                      onClick={requestPackage}
                    >
                      {activePackage.cta} <ArrowUpRight aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </div>
            </article>
          </>
        )}

        {isDroneShowCategory && (
          <section className="nr-package-drone-request" data-testid="drone-show-quote" aria-labelledby="drone-show-quote-title">
            <figure>
              <img
                src={getPackageVisual({ category: DRONE_REQUEST_CATEGORY })}
                alt="Spectacol cu drone FireArtRo"
                loading="eager"
                decoding="async"
              />
            </figure>
            <div>
              <p>Drone show</p>
              <h2 id="drone-show-quote-title">Ofertă personalizată pentru un show cu drone.</h2>
              <span>Trimite data, locația și direcția dorită, iar propunerea se construiește după brief.</span>
              <button type="button" data-testid="drone-show-quote-cta" onClick={requestDroneQuote}>
                Solicită ofertă personalizată <ArrowUpRight aria-hidden="true" />
              </button>
            </div>
          </section>
        )}

        {activePackage && hasPackageVariants && (
          <Dialog
            open={isVideoOpen}
            onOpenChange={(open) => setVideoPackageId(open ? activePackage.id : "")}
          >
            <DialogContent
              className="nr-package-video-dialog"
              overlayClassName="nr-package-video-dialog__overlay"
              data-testid="package-video-dialog"
              aria-describedby={undefined}
            >
              <DialogTitle className="sr-only">
                Videoclip pentru {activePackage.title}
              </DialogTitle>
              {videoEmbedUrl ? (
                <iframe
                  key={activePackage.id}
                  src={videoEmbedUrl}
                  title={`Video demonstrativ pentru pachetul ${activePackage.title}`}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                  referrerPolicy="strict-origin-when-cross-origin"
                />
              ) : (
                <video key={activePackage.id} src={primaryVideoUrl} controls autoPlay playsInline preload="metadata" />
              )}
            </DialogContent>
          </Dialog>
        )}
      </div>
    </section>
  );
};

export default Packages;
