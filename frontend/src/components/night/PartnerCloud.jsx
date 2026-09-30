import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { partnerDestination } from "@/data/partnerCatalog";

function PartnerMark({ partner, decorative = false, loadLogos = false }) {
  const [failedSource, setFailedSource] = useState(null);
  const hasLogo = partner.logo && failedSource !== partner.logo;

  return <li className="fa-partner" data-partner-id={partner.id} aria-hidden={decorative ? "true" : undefined}>
    <a href={partnerDestination(partner)} target="_blank" rel="noopener noreferrer" tabIndex={decorative ? -1 : undefined}
      // Pointer focus must not reset a translated lane between press and release.
      // Keyboard focus still reveals the stationary, accessible original links.
      onPointerDown={event => { if (event.button === 0) event.preventDefault(); }}
      aria-label={`Deschide ${partner.name} într-o filă nouă`}
      className={`fa-partner__body${hasLogo ? "" : " fa-partner__body--text"}`}>
      {hasLogo && <span className="fa-partner__mark" data-theme={partner.theme || "light"}>
        <img src={partner.logo} alt="" width="160" height="80" loading={loadLogos ? "eager" : "lazy"} decoding="async" onError={() => setFailedSource(partner.logo)} />
      </span>}
      <span className="fa-partner__name" data-partner-name={decorative ? undefined : ""}>{partner.name}</span>
      <svg className="fa-partner__external" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M7 17 17 7M7 7h10v10" /></svg>
    </a>
  </li>;
}

function PartnerLane({ partners, direction, moving, index, repeats, loadLogos }) {
  if (!partners.length) return null;

  return <div className="fa-partner-lane" data-partner-lane data-direction={direction} data-motion={moving ? "moving" : "static"}>
    <div className="fa-partner-lane__track">
      <ul className="fa-partner-lane__group" data-marquee-copy="false" aria-label={`Parteneri și colaboratori, rândul ${index + 1}`}>
        {Array.from({ length: repeats }).flatMap((_, cycle) => partners.map(partner =>
          <PartnerMark key={`${cycle}-${partner.id}`} partner={partner} decorative={cycle > 0} loadLogos={loadLogos} />))}
      </ul>
      {moving && <ul className="fa-partner-lane__group" data-marquee-copy="true" aria-hidden="true">
        {Array.from({ length: repeats }).flatMap((_, cycle) => partners.map(partner =>
          <PartnerMark key={`copy-${cycle}-${partner.id}`} partner={partner} decorative loadLogos={loadLogos} />))}
      </ul>}
    </div>
  </div>;
}

export default function PartnerCloud({ partners, copy, title, reduceMotion }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  const [focusedPartner, setFocusedPartner] = useState(null);
  const [documentVisible, setDocumentVisible] = useState(!document.hidden);
  const [repeats, setRepeats] = useState([1, 1]);
  const canMove = !reduceMotion && partners.length > 1;
  const moving = canMove && !focusedPartner;
  const running = moving && visible && documentVisible;
  const midpoint = Math.ceil(partners.length / 2);
  const lanes = [partners.slice(0, midpoint), partners.slice(midpoint)];

  useLayoutEffect(() => {
    if (focusedPartner && ref.current.contains(document.activeElement)) {
      // A translated original may be outside the viewport. Static lanes let
      // native focus scrolling reveal it without exposing decorative copies.
      document.activeElement.scrollIntoView?.({ block: "nearest", inline: "nearest", behavior: "instant" });
    } else if (moving) {
      ref.current.querySelectorAll("[data-partner-lane]").forEach(lane => { lane.scrollLeft = 0; });
    }
  }, [focusedPartner, moving]);

  useLayoutEffect(() => {
    if (!moving) return undefined;
    const laneNodes = [...ref.current.querySelectorAll("[data-partner-lane]")];
    const measure = () => {
      const next = laneNodes.map((lane, index) => {
        const firstCard = lane.querySelector(".fa-partner");
        const cardWidth = firstCard?.getBoundingClientRect().width || 0;
        const gap = Number.parseFloat(firstCard ? getComputedStyle(firstCard).marginRight : "0") || 0;
        const cycleWidth = (cardWidth + gap) * (index === 0 ? midpoint : partners.length - midpoint);
        return cycleWidth > 0 ? Math.max(1, Math.ceil((lane.getBoundingClientRect().width + 1) / cycleWidth)) : 1;
      });
      setRepeats(current => current.every((count, index) => count === next[index]) ? current : next);
    };
    measure();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    laneNodes.forEach(lane => {
      observer?.observe(lane);
      const firstCard = lane.querySelector(".fa-partner");
      if (firstCard) observer?.observe(firstCard);
    });
    window.addEventListener("resize", measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [moving, midpoint, partners.length]);

  useEffect(() => {
    if (!canMove) return undefined;
    const onVisibility = () => setDocumentVisible(!document.hidden);
    document.addEventListener("visibilitychange", onVisibility);
    const observer = typeof IntersectionObserver === "undefined" ? null : new IntersectionObserver(entries => {
      setVisible(entries.some(entry => entry.isIntersecting));
    }, { threshold: 0 });
    if (observer) observer.observe(ref.current);
    else setVisible(true);
    return () => {
      observer?.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [canMove]);

  return <div ref={ref} className="fa-partner-marquee" data-testid="partner-marquee" data-running={running ? "true" : "false"}
    onFocusCapture={event => {
      const partner = event.target.closest(".fa-partner__body");
      if (partner && !partner.closest('[aria-hidden="true"]')) setFocusedPartner(partner);
    }}
    onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setFocusedPartner(null); }}>
    <header className="fa-partner-marquee__head">
      <div className="fa-partner-marquee__copy">
        {copy.eyebrow && <p className="fa-kicker">{copy.eyebrow}</p>}
        <h2 id="fa-partners-title">{title}</h2>
        <p className="fa-partner-marquee__caption">Parteneri &amp; colaboratori</p>
      </div>
    </header>
    <div className="fa-partner-marquee__lanes">
      <PartnerLane partners={lanes[0]} direction="right" moving={moving} index={0} repeats={moving ? repeats[0] : 1} loadLogos={visible} />
      <PartnerLane partners={lanes[1]} direction="left" moving={moving} index={1} repeats={moving ? repeats[1] : 1} loadLogos={visible} />
    </div>
  </div>;
}
