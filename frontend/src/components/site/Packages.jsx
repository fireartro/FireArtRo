import { CMS_DEFAULTS } from "@/data/cmsDefaults";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import PackageVideoPlayer from "./PackageVideoPlayer";
import { useLocation, useNavigate } from "react-router-dom";
import { PACKAGE_CATEGORIES } from "@/data/businessContent";
import { MEDIA } from "@/data/content";
import useManagedContent from "@/hooks/useManagedContent";
import { goToContact } from "@/lib/contactNavigation";
import ManagedPageMedia from "@/components/site/ManagedPageMedia";
import {
  buildCategoryRanges,
  DRONE_REQUEST_CATEGORY,
  getCategoryLabel,
  getCategoryPhoto,
  resolveCategory,
} from "@/lib/categoryNavigation";

import "@/styles/category-navigation.css";

const visualByCategory = {
  "Artificii de zi": MEDIA.corporate,
  "Artificii de noapte": MEDIA.fireworksSky,
  "Show drone": MEDIA.droneShow,
  "Drone + artificii": MEDIA.hybrid,
  "Efecte speciale": MEDIA.coldSparks,
  "Corporate / Festival": MEDIA.crowd,
};

const packageConfiguration = (item) => {
  if (item.droneCount && item.effectsCount) return `${item.droneCount} drone + ${item.effectsCount} grupe de efecte`;
  if (item.droneCount) return `${item.droneCount} drone`;
  if (item.effectsCount) return `${item.effectsCount} grupe de efecte`;
  if (item.category === "Artificii de zi") return "Pachet pirotehnic de zi";
  if (item.category === "Artificii de noapte") return "Pachet pirotehnic de noapte";
  if (item.category === "Efecte speciale") return "Configurație mixtă";
  return "După brief";
};

const getPackageVisual = (item, mediaById) => (
  mediaById?.get(item?.imageMediaId)?.src
  || visualByCategory[item?.category]
  || MEDIA.fireworksSky
);

export const Packages = ({ items }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const copy = useManagedContent("packagesPage", CMS_DEFAULTS.packagesPage);
  const mediaItems = useManagedContent("mediaItems", CMS_DEFAULTS.mediaItems);
  const mediaById = useMemo(() => new Map(mediaItems.map((item) => [item.id, item])), [mediaItems]);
  const managedPackages = useManagedContent("packages", CMS_DEFAULTS.packages);
  const packages = Array.isArray(items) ? items : managedPackages;
  const categories = useMemo(() => {
    const ordered = buildCategoryRanges(packages, { includeDroneRequest: true }).map((range) => range.category);
    return ordered.filter((item) => PACKAGE_CATEGORIES.includes(item) || packages.some((pkg) => pkg.category === item));
  }, [packages]);
  const requestedCategory = useMemo(
    () => new URLSearchParams(location.search).get("categorie") || "",
    [location.search],
  );
  const initialCategory = resolveCategory(requestedCategory, categories);
  const initialPackage = packages.find((item) => item.category === initialCategory) || packages[0];
  const [category, setCategory] = useState(initialCategory);
  const [selectedId, setSelectedId] = useState(initialPackage?.id || "");
  const [displayedId, setDisplayedId] = useState(initialPackage?.id || "");
  const [transitionState, setTransitionState] = useState("idle");
  const variantRefs = useRef([]);
  const categoryRefs = useRef([]);
  const timersRef = useRef([]);
  const reduceMotion = useReducedMotion();

  const variants = useMemo(
    () => packages.filter((item) => item.category === category),
    [category, packages],
  );
  const isDroneShowCategory = category === DRONE_REQUEST_CATEGORY;
  const hasPackageVariants = variants.length > 0;
  const activePackage = packages.find((item) => item.id === displayedId) || variants[0] || packages[0];
  const packageThumbnail = getPackageVisual(activePackage, mediaById);

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

    }
  }, [categories, category, packages, selectedId]);

  useEffect(() => {
    const nextCategory = resolveCategory(requestedCategory, categories);
    if (!nextCategory || nextCategory === category) return;
    const first = packages.find((item) => item.category === nextCategory);
    timersRef.current.forEach(window.clearTimeout);
    setCategory(nextCategory);
    setSelectedId(first?.id || "");
    setDisplayedId(first?.id || "");
    setTransitionState("idle");

  }, [categories, category, packages, requestedCategory]);

  const updateCategoryQuery = useCallback((nextCategory) => {
    const params = new URLSearchParams(location.search);
    params.set("categorie", nextCategory);
    navigate(`${location.pathname}?${params.toString()}`, { replace: true });
  }, [location.pathname, location.search, navigate]);

  const swapPackage = (nextPackage) => {
    if (!nextPackage || nextPackage.id === selectedId) return;

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
    updateCategoryQuery(nextCategory);
    if (!first) return;
    if (first.id === selectedId) {
      setDisplayedId(first.id);
      return;
    }
    swapPackage(first);
  };

  const handleCategoryKeyDown = (event, index) => {
    let nextIndex = null;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") nextIndex = (index + 1) % categories.length;
    if (event.key === "ArrowLeft" || event.key === "ArrowUp") nextIndex = (index - 1 + categories.length) % categories.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = categories.length - 1;
    if (nextIndex === null) return;
    event.preventDefault();
    changeCategory(categories[nextIndex]);
    window.requestAnimationFrame(() => categoryRefs.current[nextIndex]?.focus());
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
          {categories.map((item, index) => (
            <button
              key={item}
              ref={(node) => { categoryRefs.current[index] = node; }}
              type="button"
              role="tab"
              aria-selected={category === item}
              tabIndex={category === item ? 0 : -1}
              className={category === item ? "is-active" : ""}
              onClick={() => changeCategory(item)}
              onKeyDown={(event) => handleCategoryKeyDown(event, index)}
            >
              {getCategoryLabel(item)}
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
                    <small>{getCategoryLabel(item.category)}</small>
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
                <PackageVideoPlayer key={activePackage.id} item={activePackage} fallback={packageThumbnail} label={getCategoryLabel(activePackage.category)} changing={selectedId !== displayedId} />

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

        {isDroneShowCategory && !hasPackageVariants && (
          <section className="nr-package-drone-request" data-testid="drone-show-quote" aria-labelledby="drone-show-quote-title">
            <figure>
              <img
                src={getCategoryPhoto(DRONE_REQUEST_CATEGORY, mediaById) || getPackageVisual({ category: DRONE_REQUEST_CATEGORY })}
                alt="Spectacol cu drone FireArtRo"
                loading="eager"
                decoding="async"
              />
            </figure>
            <div>
              <p>Spectacole de drone</p>
              <h2 id="drone-show-quote-title">Ofertă personalizată pentru un show cu drone.</h2>
              <span>Trimite data, locația și direcția dorită, iar propunerea se construiește după brief.</span>
              <button type="button" data-testid="drone-show-quote-cta" onClick={requestDroneQuote}>
                Solicită ofertă personalizată <ArrowUpRight aria-hidden="true" />
              </button>
            </div>
          </section>
        )}


      </div>
    </section>
  );
};

export default Packages;
