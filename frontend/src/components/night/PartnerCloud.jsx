import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { partnerCloudStyle } from "./partnerCloudLayout";

function PartnerMark({ partner }) {
  const [failedSource, setFailedSource] = useState(null);
  const hasLogo = partner.logo && failedSource !== partner.logo;
  return <div className="fa-partner__float">
    <div className="fa-partner__body">
      {hasLogo ? <div className="fa-partner__mark" data-theme={partner.theme || "light"}>
        <img src={partner.logo} alt="" width="200" height="96" loading="lazy" decoding="async" onError={() => setFailedSource(partner.logo)} />
      </div> : <span className="fa-partner__wordmark" aria-hidden="true">{partner.name}</span>}
    </div>
    <span className="fa-partner__name" data-partner-name>{partner.name}</span>
  </div>;
}

export default function PartnerCloud({ partners, copy, title, reduceMotion }) {
  const ref = useRef(null);
  const [expanded, setExpanded] = useState(false);
  const [paused, setPaused] = useState(false);
  const [visible, setVisible] = useState(false);
  const [documentVisible, setDocumentVisible] = useState(!document.hidden);
  const canFloat = !reduceMotion && partners.length === 26;
  const list = !canFloat || expanded;
  const running = canFloat && !list && !paused && visible && documentVisible;
  useEffect(() => {
    if (!canFloat) return undefined;
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
  }, [canFloat]);

  return <div ref={ref} className="fa-partner-cloud" data-testid="partner-cloud" data-view={list ? "list" : "cloud"} data-running={running ? "true" : "false"}>
    <header className="fa-partner-cloud__copy">
      <p className="fa-kicker">{copy.eyebrow}</p>
      <h2 id="fa-partners-title">{title}</h2>
      <span className="fa-partner-cloud__caption">Parteneri & colaboratori</span>
      <div className="fa-partner-cloud__controls">
        {canFloat && <button type="button" className="fa-partner-cloud__all" aria-controls="fireart-partner-marks" aria-expanded={expanded} onClick={() => setExpanded(value => !value)}>
          {expanded ? "Înapoi la spectacol" : `Vezi toți cei ${partners.length} parteneri`}<span aria-hidden="true">{expanded ? "↖" : "↗"}</span>
        </button>}
        {canFloat && !list && <button type="button" className="fa-partner-cloud__pause" aria-label={paused ? "Pornește animația siglelor" : "Oprește animația siglelor"} aria-pressed={paused} onClick={() => setPaused(value => !value)}>
          <svg viewBox="0 0 24 24" aria-hidden="true">{paused ? <path d="m9 6 9 6-9 6Z" /> : <path d="M8 6h2v12H8zm6 0h2v12h-2z" />}</svg>
        </button>}
      </div>
      {copy.ctaLabel && <Link className="fa-line-link" to={copy.ctaHref}>{copy.ctaLabel}</Link>}
    </header>
    <ul id="fireart-partner-marks" className="fa-partner-cloud__marks" aria-label="Parteneri și colaboratori FireArtRo">
      {partners.map((partner, index) => <li className="fa-partner" data-partner-id={partner.id} key={partner.id} style={partnerCloudStyle(index)}>
        <PartnerMark partner={partner} />
      </li>)}
    </ul>
  </div>;
}
