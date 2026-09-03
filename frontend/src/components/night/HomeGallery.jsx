import { useLayoutEffect, useMemo, useRef } from "react";
import { ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";
import { useReducedMotion } from "framer-motion";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { CMS_DEFAULTS } from "@/data/cmsDefaults";
import useManagedContent from "@/hooks/useManagedContent";

gsap.registerPlugin(ScrollTrigger);

export default function HomeGallery() {
  const homePage = useManagedContent("homePage", CMS_DEFAULTS.homePage);
  const mediaItems = useManagedContent("mediaItems", CMS_DEFAULTS.mediaItems);
  const copy = homePage.gallery;
  const galleryItems = useMemo(() => {
    const byId = new Map(mediaItems.map((item) => [item.id, item]));
    return homePage.promoSlides.flatMap((slide) => {
      const media = byId.get(slide.mediaId);
      if (!media && slide.type !== "youtube") return [];
      return [{ ...slide, media }];
    });
  }, [homePage.promoSlides, mediaItems]);
  const sectionRef = useRef(null);
  const reduceMotion = useReducedMotion();

  useLayoutEffect(() => {
    const section = sectionRef.current;
    if (!section || reduceMotion) return undefined;

    let cleanupMotion = () => {};

    const context = gsap.context(() => {
      const track = section.querySelector(".fa-work__track");
      const viewport = section.querySelector(".fa-work__viewport");
      const intro = section.querySelector(".fa-work__intro");
      const outroContent = section.querySelector(".fa-work__outro-inner");
      const panels = gsap.utils.toArray("[data-gallery-panel]", section);
      const lifts = panels.map((panel) => panel.querySelector("[data-gallery-lift]"));
      if (
        !track
        || !viewport
        || !intro
        || !outroContent
        || !panels.length
        || lifts.some((lift) => !lift)
      ) return;

      let travelDistance = 0;
      let liftDistance = 0;
      let viewportWidth = 0;
      let panelMetrics = [];
      let refreshFrame = 0;
      let settleTimer = 0;
      let resizeObserver;
      let lastViewportWidth = viewport.clientWidth || window.innerWidth;
      let lastViewportHeight = window.innerHeight;
      let lastPortrait = window.matchMedia("(orientation: portrait)").matches;
      const setTrackX = gsap.quickSetter(track, "x", "px");
      const setLiftY = lifts.map((lift) => gsap.quickSetter(lift, "y", "px"));
      const setIntroOpacity = gsap.quickSetter(intro, "opacity");
      const setOutroOpacity = gsap.quickSetter(outroContent, "opacity");
      const touchDriven = window.matchMedia(
        "(max-width: 899px), (hover: none) and (pointer: coarse)",
      ).matches;

      const measure = () => {
        liftDistance = Math.min(550, window.innerHeight * 0.61);
        viewportWidth = viewport.clientWidth || window.innerWidth;
        section.style.setProperty("--nr-scene-width", `${viewportWidth}px`);
        travelDistance = Math.max(0, track.scrollWidth - viewportWidth);
        panelMetrics = panels.map((panel) => ({
          left: panel.offsetLeft,
          width: panel.offsetWidth,
        }));
      };

      const positionPanels = (progress) => {
        const horizontalOffset = progress * travelDistance;

        panels.forEach((_panel, index) => {
          const metric = panelMetrics[index];
          const centerRatio = (
            metric.left - horizontalOffset + metric.width / 2
          ) / viewportWidth;
          const riseProgress = gsap.utils.clamp(0, 1, (1.2 - centerRatio) / 0.7);
          const outroSettleProgress = index === panels.length - 1
            ? gsap.utils.clamp(0, 1, (progress - 0.28) / 0.12)
            : 0;
          const resolvedRise = Math.max(riseProgress, outroSettleProgress);
          const y = liftDistance * ((1 - resolvedRise) ** 3);
          setLiftY[index](y);
        });
      };

      const motion = { progress: 0 };
      const renderMotion = () => {
        const progress = motion.progress;
        const introOpacity = 1 - gsap.utils.clamp(0, 1, (progress - 0.025) / 0.07);
        const outroOpacity = gsap.utils.clamp(0, 1, (progress - 0.89) / 0.1);
        setTrackX(-progress * travelDistance);
        positionPanels(progress);
        setIntroOpacity(introOpacity);
        setOutroOpacity(outroOpacity);
      };

      measure();
      gsap.set(lifts, { y: liftDistance, force3D: true });
      gsap.set(track, { x: 0, force3D: true });
      renderMotion();

      const advanceTouchMotion = (targetProgress) => {
        const delta = targetProgress - motion.progress;
        if (Math.abs(delta) < 0.0005) {
          if (motion.progress === targetProgress) return;
          motion.progress = targetProgress;
        } else {
          // Safari/WebKit may throttle animation frames during a fast scroll or
          // an orientation change. Keep ordinary touch scrolling eased, but
          // catch up in one frame when the viewport jumps across most of the
          // pinned scene so the outgoing image cannot remain stranded.
          const distance = Math.abs(delta);
          const jumpsToBoundary = (targetProgress <= 0.015 || targetProgress >= 0.985)
            && distance >= 0.25;
          const response = jumpsToBoundary
            ? 0.985
            : Math.min(0.62, 0.38 + distance * 0.28);
          motion.progress += delta * response;
        }
        renderMotion();
      };

      const galleryTrigger = ScrollTrigger.create({
        id: "fireart-gallery-track",
        trigger: section,
        start: "top top",
        end: () => {
          measure();
          const compactScene = window.matchMedia(
            "(max-width: 899px), (hover: none) and (pointer: coarse), "
              + "(min-width: 900px) and (max-width: 1199px) and (orientation: portrait), "
              + "(min-width: 900px) and (max-width: 999px) and (max-height: 560px) and (orientation: landscape)",
          ).matches;
          const scrollRunwayMultiplier = compactScene ? 0.44 : 0.48;
          const viewportRunwayMultiplier = compactScene ? 0.82 : 0.95;
          return `+=${Math.max(
            viewportWidth * viewportRunwayMultiplier,
            travelDistance * scrollRunwayMultiplier,
          )}`;
        },
        pin: ".fa-work__sticky",
        invalidateOnRefresh: true,
        anticipatePin: 1,
        onUpdate: (self) => {
          if (touchDriven) return;
          motion.progress = self.progress;
          renderMotion();
        },
        onRefresh: (self) => {
          measure();
          motion.progress = self.progress;
          renderMotion();
        },
      });

      const getTouchTarget = () => {
        if (!touchDriven) return;
        const trigger = galleryTrigger;
        if (!trigger || trigger.end <= trigger.start) return;
        return gsap.utils.clamp(
          0,
          1,
          (window.scrollY - trigger.start) / (trigger.end - trigger.start),
        );
      };

      const syncTouchMotion = () => {
        const targetProgress = getTouchTarget();
        if (targetProgress === undefined) return;
        advanceTouchMotion(targetProgress);
      };

      const syncTouchBoundary = () => {
        const targetProgress = getTouchTarget();
        if (targetProgress === undefined || (targetProgress > 0.015 && targetProgress < 0.985)) return;
        advanceTouchMotion(targetProgress);
      };

      if (touchDriven) {
        gsap.ticker.add(syncTouchMotion);
        window.addEventListener("scroll", syncTouchBoundary, { passive: true });
      }

      const refreshGeometry = () => {
        window.cancelAnimationFrame(refreshFrame);
        refreshFrame = window.requestAnimationFrame(() => {
          const nextViewportWidth = viewport.clientWidth || window.innerWidth;
          const nextViewportHeight = window.innerHeight;
          const nextPortrait = window.matchMedia("(orientation: portrait)").matches;
          const meaningfulResize = Math.abs(nextViewportWidth - lastViewportWidth) > 1
            || Math.abs(nextViewportHeight - lastViewportHeight) > 96
            || nextPortrait !== lastPortrait;
          if (!meaningfulResize) return;

          lastViewportWidth = nextViewportWidth;
          lastViewportHeight = nextViewportHeight;
          lastPortrait = nextPortrait;
          measure();
          renderMotion();
          ScrollTrigger.refresh();
        });
      };

      const scheduleGeometryRefresh = () => {
        refreshGeometry();
        window.clearTimeout(settleTimer);
        settleTimer = window.setTimeout(refreshGeometry, 160);
      };

      window.addEventListener("resize", scheduleGeometryRefresh, { passive: true });
      window.addEventListener("orientationchange", scheduleGeometryRefresh, { passive: true });
      window.visualViewport?.addEventListener("resize", scheduleGeometryRefresh, { passive: true });
      if (typeof ResizeObserver !== "undefined") {
        resizeObserver = new ResizeObserver(scheduleGeometryRefresh);
        resizeObserver.observe(viewport);
      }

      cleanupMotion = () => {
        window.cancelAnimationFrame(refreshFrame);
        window.clearTimeout(settleTimer);
        resizeObserver?.disconnect();
        gsap.ticker.remove(syncTouchMotion);
        window.removeEventListener("scroll", syncTouchBoundary);
        window.removeEventListener("resize", scheduleGeometryRefresh);
        window.removeEventListener("orientationchange", scheduleGeometryRefresh);
        window.visualViewport?.removeEventListener("resize", scheduleGeometryRefresh);
        galleryTrigger.kill();
        section.style.removeProperty("--nr-scene-width");
      };
    }, section);

    return () => {
      cleanupMotion();
      context.revert();
    };
  }, [galleryItems, reduceMotion]);

  return (
    <section
      id="spectacole"
      ref={sectionRef}
      className="fa-work"
      data-home-scene="gallery"
      data-testid="home-gallery"
      data-motion={reduceMotion ? "static" : "scroll"}
      aria-labelledby="fa-work-title"
    >
      <div className="fa-work__sticky">
        <div className="fa-work__viewport">
          <div className="fa-work__track">
            <header className="fa-work__intro">
              <p className="fa-kicker">{copy.eyebrow}</p>
              <h2 id="fa-work-title" style={{ whiteSpace: "pre-line" }}>{copy.title}</h2>
              {copy.description && <p>{copy.description}</p>}
              {copy.ctaLabel && <Link className="fa-line-link" to={copy.ctaHref}>
                <span>{copy.ctaLabel}</span>
                <ArrowUpRight aria-hidden="true" />
              </Link>}
            </header>

            {galleryItems.map((item) => (
              <article
                className="fa-work__card"
                data-gallery-item
                data-gallery-panel
                key={item.id}
              >
                <div className="fa-work__card-inner" data-gallery-lift>
                  <figure>
                    {item.type === "video" ? (
                      <video src={item.media.src} poster={item.media.poster} controls playsInline preload="metadata" aria-label={item.media.alt} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : item.type === "youtube" ? (
                      <a href={item.youtubeUrl || item.media?.youtubeUrl} target="_blank" rel="noopener noreferrer" aria-label={item.ctaLabel}>
                        {item.media && <img src={item.media.poster || item.media.thumbnail} alt={item.media.alt} loading="lazy" decoding="async" />}
                        {!item.media && <span>{item.ctaLabel}</span>}
                      </a>
                    ) : (
                      <Link to={item.ctaHref} aria-label={item.ctaLabel} title={item.shortText}>
                        <img src={item.media.src} alt={item.media.alt} loading="lazy" decoding="async" />
                      </Link>
                    )}
                  </figure>
                  <div className="fa-work__meta">
                    <p>{item.badge || item.media?.category}</p>
                    <h3>{item.title}</h3>
                  </div>
                </div>
              </article>
            ))}

            <aside className="fa-work__outro" data-gallery-panel>
              <div className="fa-work__outro-inner" data-gallery-lift>
                <p className="fa-kicker">Dincolo de cadru</p>
                <h3>Spectacolul continuă.</h3>
                <Link className="fa-line-link" to="/galerie">
                  <span>Intră în galerie</span>
                  <ArrowUpRight aria-hidden="true" />
                </Link>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </section>
  );
}
