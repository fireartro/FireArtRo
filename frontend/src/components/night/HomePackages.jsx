import { CMS_DEFAULTS } from "@/data/cmsDefaults";
import { useLayoutEffect, useMemo, useRef } from "react";
import { ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";
import { useReducedMotion } from "framer-motion";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import useManagedContent from "@/hooks/useManagedContent";

import { goToContact } from "@/lib/contactNavigation";

gsap.registerPlugin(ScrollTrigger);

const FEATURED_PACKAGE_IDS = [
  "fireworks-multicolor-2026",
  "fireworks-gold-2026",
  "fireworks-diamond-piromusical-2026",
];

export default function HomePackages() {
  const homePage = useManagedContent("homePage", CMS_DEFAULTS.homePage);
  const copy = homePage.packages;
  const sectionRef = useRef(null);
  const reduceMotion = useReducedMotion();
  const managedPackages = useManagedContent("packages", CMS_DEFAULTS.packages);
  const featuredPackages = useMemo(
    () => FEATURED_PACKAGE_IDS
      .map((id) => managedPackages.find((item) => item.id === id))
      .filter(Boolean),
    [managedPackages],
  );

  const requestPackage = (item) => item.ctaHref && item.ctaHref !== "/contact"
    ? window.location.assign(item.ctaHref)
    : goToContact({
    package_id: item.id,
    package_title: item.title,
    services: [item.category],
  });

  useLayoutEffect(() => {
    const section = sectionRef.current;
    if (!section) return undefined;

    const revealFocusedPanel = (event) => {
      if (!event.target?.matches?.(":focus-visible")) return;
      const panel = event.target?.closest?.("[data-package-panel]");
      if (!panel || !section.contains(panel)) return;

      gsap.killTweensOf(panel);
      gsap.set(panel, { y: 0, opacity: 1 });
    };

    section.addEventListener("focusin", revealFocusedPanel);

    if (reduceMotion) {
      return () => section.removeEventListener("focusin", revealFocusedPanel);
    }

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
  }, [featuredPackages.length, reduceMotion]);

  return (
    <section
      ref={sectionRef}
      className="fa-packages"
      data-home-scene="packages"
      data-testid="home-packages"
      data-motion={reduceMotion ? "static" : "reveal"}
      aria-labelledby="fa-packages-title"
    >
      <div className="fa-packages__inner nr-shell">
        <header className="fa-packages__header">
          <p className="fa-kicker">{copy.eyebrow}</p>
          <h2 id="fa-packages-title">{copy.title}</h2>
          {copy.description && <p>{copy.description}</p>}
        </header>

        <div className="fa-packages__triptych" data-package-triptych>
          {featuredPackages.map((item, index) => (
            <article data-package-panel data-package-id={item.id} className="fa-package-panel" key={item.id}>
              <div className="fa-package-panel__topline">
                <span>{String(index + 1).padStart(2, "0")}</span>
                <span>{item.category}</span>
              </div>
              <div className="fa-package-panel__body">
                {item.badge && <p className="fa-package-panel__badge">{item.badge}</p>}
                <h3>{item.title}</h3>
                <p>{item.shortDescription}</p>
                <dl>
                  <div><dt>Durată</dt><dd>{item.duration}</dd></div>
                  <div><dt>Potrivit pentru</dt><dd>{item.bestFor}</dd></div>
                </dl>
                <ul>{item.highlights.slice(0, 3).map((value) => <li key={value}>{value}</li>)}</ul>
              </div>
              <button type="button" data-package-request onClick={() => requestPackage(item)}>
                <span>{item.cta}</span><ArrowUpRight aria-hidden="true" />
              </button>
            </article>
          ))}
        </div>

        {copy.ctaLabel && <Link className="fa-line-link fa-packages__all" to={copy.ctaHref}>
          <span>{copy.ctaLabel}</span><ArrowUpRight aria-hidden="true" />
        </Link>}
      </div>
    </section>
  );
}
