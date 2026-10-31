import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { partnerDestination } from '@/data/partnerCatalog';

function Mark({ partner }) {
  const [failed, setFailed] = useState(null);
  const logo = partner.logo && failed !== partner.logo;
  return <a className="fa-partner__body" data-partner-id={partner.id} href={partnerDestination(partner)} target="_blank" rel="noopener noreferrer" aria-label={`Deschide ${partner.name}`}>
    {logo && <span className="fa-partner__mark" data-theme={partner.theme || 'light'}><img src={partner.logo} alt="" loading="lazy" decoding="async" onError={() => setFailed(partner.logo)} /></span>}
    <span className="fa-partner__name" data-partner-name>{partner.name}</span>
  </a>;
}

export default function PartnerScrollScene({ partners, copy, title, reduceMotion }) {
  const ref = useRef(null);
  const host = useRef(null);
  useEffect(() => {
    const node = ref.current;
    const canvasHost = host.current;
    if (reduceMotion || !window.IntersectionObserver || !window.ResizeObserver) return undefined;
    let disposed = false, stop, started = false;
    node.dataset.layout = 'ribbon-loading';
    const fallback = () => {
      node.dataset.layout = 'grid';
      stop?.();
      canvasHost.replaceChildren();
    };
    const observer = new IntersectionObserver(async ([entry]) => {
      if (!entry.isIntersecting || started) return;
      started = true;
      observer.disconnect();
      try {
        const {mountPartnerRibbons} = await import('./partnerRibbonEngine');
        if (disposed) return;
        const canvas = document.createElement('canvas');
        canvas.setAttribute('aria-hidden', 'true');
        canvasHost.appendChild(canvas);
        stop = mountPartnerRibbons({
          canvas, section:node, partners,
          onReady:() => { node.dataset.layout = 'ribbons'; },
          onFailure:fallback,
        });
      } catch { if (!disposed) fallback(); }
    }, {rootMargin:'900px 0px'});
    observer.observe(node);
    return () => {
      disposed = true;
      observer.disconnect();
      stop?.();
      canvasHost.replaceChildren();
      node.dataset.layout = 'grid';
    };
  }, [partners, reduceMotion]);

  return <div ref={ref} className="fa-partner-scroll" data-testid="partner-scroll" data-layout="grid">
    <div className="fa-partner-scroll__stage">
      <header className="fa-partner-scroll__copy"><p className="fa-kicker">{copy.eyebrow}</p><h2 id="fa-partners-title">{title}</h2>
        <p>Parteneri &amp; colaboratori</p>
        {copy.ctaLabel && <Link className="fa-line-link" to={copy.ctaHref}>{copy.ctaLabel}</Link>}
      </header>
      <div ref={host} className="fa-partner-ribbon__canvas" />
      <ul id="fireart-partner-marks" className="fa-partner-scroll__marks" aria-label="Parteneri și colaboratori FireArtRo">
        {partners.map(partner => <li className="fa-partner" key={partner.id} data-partner-id={partner.id}><Mark partner={partner} /></li>)}
      </ul>
    </div>
  </div>;
}
