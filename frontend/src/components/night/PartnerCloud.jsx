import { useEffect, useLayoutEffect, useRef, useState } from "react";

function PartnerMark({ partner, decorative = false }) {
  const [failedSource, setFailedSource] = useState(null);
  const hasLogo = partner.logo && failedSource !== partner.logo;

  return <li className="fa-partner" data-partner-id={partner.id} aria-hidden={decorative ? "true" : undefined}>
    <div className={`fa-partner__body${hasLogo ? "" : " fa-partner__body--text"}`}>
      {hasLogo && <span className="fa-partner__mark" data-theme={partner.theme || "light"}>
        <img src={partner.logo} alt="" width="160" height="80" loading="lazy" decoding="async" onError={() => setFailedSource(partner.logo)} />
      </span>}
      <span className="fa-partner__name" data-partner-name={decorative ? undefined : ""}>{partner.name}</span>
    </div>
  </li>;
}

function PartnerLane({ partners, direction, moving, index, repeats }) {
  if (!partners.length) return null;

  return <div className="fa-partner-lane" data-partner-lane data-direction={direction} data-motion={moving ? "moving" : "static"}>
    <div className="fa-partner-lane__track">
      <ul className="fa-partner-lane__group" data-marquee-copy="false" aria-label={`Parteneri și colaboratori, rândul ${index + 1}`}>
        {Array.from({ length: repeats }).flatMap((_, cycle) => partners.map(partner =>
          <PartnerMark key={`${cycle}-${partner.id}`} partner={partner} decorative={cycle > 0} />))}
      </ul>
      {moving && <ul className="fa-partner-lane__group" data-marquee-copy="true" aria-hidden="true">
        {Array.from({ length: repeats }).flatMap((_, cycle) => partners.map(partner =>
          <PartnerMark key={`copy-${cycle}-${partner.id}`} partner={partner} decorative />))}
      </ul>}
    </div>
  </div>;
}

export default function PartnerCloud({ partners, copy, title, reduceMotion }) {
  const ref = useRef(null);
  const [paused, setPaused] = useState(false);
  const [visible, setVisible] = useState(false);
  const [documentVisible, setDocumentVisible] = useState(!document.hidden);
  const [repeats, setRepeats] = useState([1, 1]);
  const moving = !reduceMotion && partners.length > 1;
  const running = moving && !paused && visible && documentVisible;
  const midpoint = Math.ceil(partners.length / 2);
  const lanes = [partners.slice(0, midpoint), partners.slice(midpoint)];

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
    if (!moving) return undefined;
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
  }, [moving]);

  return <div ref={ref} className="fa-partner-marquee" data-testid="partner-marquee" data-running={running ? "true" : "false"}>
    <header className="fa-partner-marquee__head">
      <div className="fa-partner-marquee__copy">
        {copy.eyebrow && <p className="fa-kicker">{copy.eyebrow}</p>}
        <h2 id="fa-partners-title">{title}</h2>
        <p className="fa-partner-marquee__caption">Parteneri &amp; colaboratori</p>
      </div>
      {moving && <button type="button" className="fa-partner-marquee__pause" aria-label={paused ? "Pornește mișcarea partenerilor" : "Oprește mișcarea partenerilor"} aria-pressed={paused} onClick={() => setPaused(value => !value)}>
        <svg viewBox="0 0 24 24" aria-hidden="true">{paused ? <path d="m9 6 9 6-9 6Z" /> : <path d="M8 6h2v12H8zm6 0h2v12h-2z" />}</svg>
      </button>}
    </header>
    <div className="fa-partner-marquee__lanes">
      <PartnerLane partners={lanes[0]} direction="right" moving={moving} index={0} repeats={moving ? repeats[0] : 1} />
      <PartnerLane partners={lanes[1]} direction="left" moving={moving} index={1} repeats={moving ? repeats[1] : 1} />
    </div>
  </div>;
}
