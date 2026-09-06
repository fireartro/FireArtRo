import { lazy, Suspense, useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import useNearViewport from "@/hooks/useNearViewport";
import SceneBoundary from "./SceneBoundary";
import { CMS_DEFAULTS } from "@/data/cmsDefaults";
import useManagedContent from "@/hooks/useManagedContent";
import { Link } from "react-router-dom";

gsap.registerPlugin(ScrollTrigger);
const PartnerOrbitCanvas = lazy(() => import("@/components/night/PartnerOrbitCanvas"));

export default function HomePartners() {
  const homePage = useManagedContent("homePage", CMS_DEFAULTS.homePage);
  const managedPartners = useManagedContent("partners", CMS_DEFAULTS.partners);
  const mediaItems = useManagedContent("mediaItems", CMS_DEFAULTS.mediaItems);
  const copy = homePage.partners;
  const partners = useMemo(() => {
    const mediaById = new Map(mediaItems.map((item) => [item.id, item]));
    return managedPartners.map((partner) => ({ ...partner, logo: mediaById.get(partner.logoMediaId)?.src }));
  }, [managedPartners, mediaItems]);
  const sectionRef = useRef(null);
  const nearViewport = useNearViewport(sectionRef, "400px");
  const canvasRef = useRef(null);
  const reduceMotion = useReducedMotion();
  const initializeScene = nearViewport && !reduceMotion;
  const [gpuState, setGpuState] = useState("warming");
  const setReady = useCallback((state) => {
    setGpuState(state);
    const trigger = ScrollTrigger.getById("fireart-partner-orbit");
    if (state === "ready" && trigger) canvasRef.current?.setProgress(trigger.progress);
  }, []);
  const setUnavailable = useCallback(() => setGpuState("fallback"), []);

  useLayoutEffect(() => {
    const section = sectionRef.current;
    if (!section || !initializeScene) return undefined;

    const trigger = ScrollTrigger.create({
      id: "fireart-partner-orbit",
      trigger: section,
      start: "top top",
      end: "bottom bottom",
      scrub: true,
      onUpdate: ({ progress }) => canvasRef.current?.setProgress(progress),
    });
    return () => trigger.kill();
  }, [initializeScene]);

  return (
    <section
      ref={sectionRef}
      className="fa-partners"
      data-home-scene="partners"
      data-testid="home-partners"
      data-gpu={reduceMotion ? "static" : gpuState}
      aria-labelledby="fa-partners-title"
    >
      <div className="fa-partners__sticky">
        <header className="fa-partners__copy">
          <p className="fa-kicker">{copy.eyebrow}</p>
          <h2 id="fa-partners-title">{copy.title}</h2>
          {copy.description && <p>{copy.description}</p>}
          {copy.ctaLabel && <Link to={copy.ctaHref}>{copy.ctaLabel}</Link>}
        </header>

        {initializeScene && partners.length > 0 && (
          <SceneBoundary onUnavailable={setUnavailable}>
            <Suspense fallback={null}>
              <PartnerOrbitCanvas ref={canvasRef} partners={partners} onReady={setReady} />
            </Suspense>
          </SceneBoundary>
        )}

        <div className="fa-partners__names" aria-label="Partenerii FireArtRo">
          {partners.map((partner) => (
            <span data-partner-name data-placeholder={partner.replaceable || undefined} key={partner.id}>
              {partner.logo && <img src={partner.logo} alt={partner.name} loading="lazy" style={{ maxWidth: "100%", maxHeight: 80 }} />}
              {partner.name}
              {partner.replaceable && <small className="sr-only"> — Spațiu rezervat pentru un partener</small>}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
