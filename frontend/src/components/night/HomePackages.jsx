import { CMS_DEFAULTS } from "@/data/cmsDefaults";
import { useLayoutEffect, useMemo, useRef } from "react";
import { ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";
import { useReducedMotion } from "framer-motion";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import useManagedContent from "@/hooks/useManagedContent";
import useNearViewport from "@/hooks/useNearViewport";
import { MEDIA } from "@/data/content";
import { buildCategoryRanges, getCategoryLabel, getCategoryPhoto } from "@/lib/categoryNavigation";
import { homeImageProps } from "@/lib/homeImage";

import "@/styles/category-navigation.css";

gsap.registerPlugin(ScrollTrigger);

const fallbackVisuals = {
  "Artificii de noapte": MEDIA.fireworksSky,
  "Artificii de zi": MEDIA.corporate,
  "Show drone": MEDIA.droneShow,
  "Drone + artificii": MEDIA.hybrid,
  "Efecte speciale": MEDIA.coldSparks,
  "Corporate / Festival": MEDIA.crowd,
};

export default function HomePackages() {
  const homePage = useManagedContent("homePage", CMS_DEFAULTS.homePage);
  const copy = homePage.packages;
  const sectionRef = useRef(null);
  const nearViewport = useNearViewport(sectionRef, "240px");
  const reduceMotion = useReducedMotion();
  const initializeScene = nearViewport && !reduceMotion;
  const managedPackages = useManagedContent("packages", CMS_DEFAULTS.packages);
  const mediaItems = useManagedContent("mediaItems", CMS_DEFAULTS.mediaItems);
  const mediaById = useMemo(() => new Map(mediaItems.map((item) => [item.id, item])), [mediaItems]);
  const categoryRanges = useMemo(
    () => buildCategoryRanges(managedPackages, { includeDroneRequest: true }),
    [managedPackages],
  );

  useLayoutEffect(() => {
    const section = sectionRef.current;
    if (!section || !initializeScene) return undefined;

    const revealFocusedPanel = (event) => {
      if (!event.target?.matches?.(":focus-visible")) return;
      const panel = event.target?.closest?.("[data-package-panel]");
      if (!panel || !section.contains(panel)) return;

      gsap.killTweensOf(panel);
      gsap.set(panel, { y: 0, opacity: 1 });
    };

    section.addEventListener("focusin", revealFocusedPanel);

    const context = gsap.context(() => {
      gsap.fromTo(
        "[data-package-panel]",
        { y: 42, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.72,
          stagger: 0.1,
          ease: "power3.out",
          scrollTrigger: {
            trigger: section,
            start: "top 72%",
            once: true,
          },
        },
      );
    }, section);

    return () => {
      section.removeEventListener("focusin", revealFocusedPanel);
      context.revert();
    };
  }, [categoryRanges.length, initializeScene]);

  return (
    <section
      ref={sectionRef}
      className="fa-packages"
      data-home-scene="packages"
      data-testid="home-packages"
      data-motion={initializeScene ? "reveal" : "static"}
      aria-labelledby="fa-packages-title"
    >
      <div className="fa-packages__inner nr-shell">
        <header className="fa-packages__header">
          <p className="fa-kicker">{copy.eyebrow}</p>
          <h2 id="fa-packages-title">{copy.title}</h2>
          {copy.description && <p>{copy.description}</p>}
        </header>

        <div className="fa-category-cards" data-package-triptych>
          {categoryRanges.map((range) => {
            const visual = mediaById.get(range.imageMediaId)?.src || getCategoryPhoto(range.category, mediaById) || fallbackVisuals[range.category] || MEDIA.fireworksSky;
            const label = getCategoryLabel(range.category);
            return (
              <Link
                data-package-panel
                data-package-category={range.category}
                className="fa-category-card"
                key={range.category}
                to={`/pachete?categorie=${encodeURIComponent(range.category)}`}
                aria-label={`Vezi ${label}`}
              >
                <span className="fa-category-card__media" aria-hidden="true">
                  <img {...homeImageProps(visual)} sizes="(max-width: 700px) 100vw, 50vw" alt="" loading="lazy" decoding="async" />
                </span>
                <div className="fa-category-card__content">
                  <h3>{label}</h3>
                  <span>{range.description}</span>
                  <span className="fa-category-card__action">
                    <span>Vezi mai multe opțiuni</span>
                    <ArrowUpRight aria-hidden="true" />
                  </span>
                </div>
              </Link>
            );
          })}
        </div>

        {copy.ctaLabel && <Link className="fa-line-link fa-packages__all" to={copy.ctaHref}>
          <span>{copy.ctaLabel}</span><ArrowUpRight aria-hidden="true" />
        </Link>}
      </div>
    </section>
  );
}
