import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { partnerDestination } from '@/data/partnerCatalog';
import { ORBIT_DURATION, orbitCamera, partnerPhase, ringKeyframes } from './partnerOrbitLayout';

function Mark({ partner }) {
  const [failed, setFailed] = useState(null);
  const logo = partner.logo && failed !== partner.logo;
  return <a className="fa-partner__body" href={partnerDestination(partner)} target="_blank" rel="noopener noreferrer" aria-label={`Deschide ${partner.name}`}>
    {logo && <span className="fa-partner__mark" data-theme={partner.theme || 'light'}><img src={partner.logo} alt="" loading="lazy" decoding="async" onError={() => setFailed(partner.logo)} /></span>}
    <span className="fa-partner__name" data-partner-name>{partner.name}</span>
  </a>;
}

export default function PartnerScrollScene({ partners, copy, title, reduceMotion }) {
  const ref = useRef(null);
  useEffect(() => {
    const node = ref.current;
    const marks = node.querySelector('ul');
    if (reduceMotion || !marks.animate || !window.ResizeObserver) return undefined;
    const cards = Array.from(marks.children);
    let animations = [];
    let phase = 0;
    let lastProgress = 0;
    let visible = false;
    let keyboardFocus = false;
    let frame = 0;

    const syncPlayback = () => {
      const running = visible && !document.hidden && !keyboardFocus;
      animations.forEach(animation => running ? animation.play() : animation.pause());
    };
    const resize = () => {
      const {width, height} = marks.getBoundingClientRect();
      if (!width || !height) return;
      phase = animations[0]?.currentTime ?? phase;
      animations.forEach(animation => animation.cancel());
      const camera = orbitCamera(width, height);
      marks.style.setProperty('--card-width', `${camera.cardWidth}px`);
      marks.style.setProperty('--card-height', `${camera.cardHeight}px`);
      const belts = [0, 1, 2].map(ring => ringKeyframes(ring, camera));
      animations = cards.map((card, index) => {
        const animation = card.animate(belts[index % 3], {
          duration: ORBIT_DURATION, iterations: Infinity,
          delay: -partnerPhase(index, cards.length) * ORBIT_DURATION, fill: 'both',
        });
        animation.currentTime = phase;
        return animation;
      });
      syncPlayback();
    };
    const scroll = () => {
      frame = 0;
      if (!visible || document.hidden || keyboardFocus) return;
      const range = Math.max(1, node.offsetHeight - marks.parentElement.offsetHeight);
      const progress = Math.max(0, Math.min(1, -node.getBoundingClientRect().top / range));
      const delta = (progress - lastProgress) * ORBIT_DURATION;
      lastProgress = progress;
      if (!delta) return;
      phase = (((animations[0]?.currentTime ?? phase) + delta) % ORBIT_DURATION + ORBIT_DURATION) % ORBIT_DURATION;
      animations.forEach(animation => { animation.currentTime = phase; });
    };
    const queueScroll = () => { if (visible && !frame) frame = requestAnimationFrame(scroll); };
    const visibility = () => { syncPlayback(); queueScroll(); };
    const focus = event => {
      if (!event.target.matches('a:focus-visible')) return;
      const index = cards.indexOf(event.target.closest('li'));
      if (index < 0) return;
      keyboardFocus = true;
      syncPlayback();
      // Bring the tabbed link to the front of its belt for keyboard activation.
      phase = ((1.25 - partnerPhase(index, cards.length)) % 1) * ORBIT_DURATION;
      animations.forEach(animation => { animation.currentTime = phase; });
    };
    const blur = event => {
      if (!node.contains(event.relatedTarget)) { keyboardFocus = false; visibility(); }
    };

    node.dataset.layout = 'orbit';
    const bounds = new ResizeObserver(resize);
    bounds.observe(marks);
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      visibility();
    });
    observer.observe(marks);
    window.addEventListener('scroll', queueScroll, {passive: true});
    window.addEventListener('pageshow', visibility);
    document.addEventListener('visibilitychange', visibility);
    node.addEventListener('focusin', focus);
    node.addEventListener('focusout', blur);
    return () => {
      bounds.disconnect();
      observer.disconnect();
      cancelAnimationFrame(frame);
      animations.forEach(animation => animation.cancel());
      window.removeEventListener('scroll', queueScroll);
      window.removeEventListener('pageshow', visibility);
      document.removeEventListener('visibilitychange', visibility);
      node.removeEventListener('focusin', focus);
      node.removeEventListener('focusout', blur);
      node.dataset.layout = 'grid';
    };
  }, [partners, reduceMotion]);

  return <div ref={ref} className="fa-partner-scroll" data-testid="partner-scroll" data-layout="grid">
    <div className="fa-partner-scroll__stage">
      <header className="fa-partner-scroll__copy"><p className="fa-kicker">{copy.eyebrow}</p><h2 id="fa-partners-title">{title}</h2>
        <p>Parteneri &amp; colaboratori</p>
        {copy.ctaLabel && <Link className="fa-line-link" to={copy.ctaHref}>{copy.ctaLabel}</Link>}
      </header>
      <ul id="fireart-partner-marks" className="fa-partner-scroll__marks" aria-label="Parteneri și colaboratori FireArtRo">
        {partners.map(partner => <li className="fa-partner" key={partner.id} data-partner-id={partner.id}><Mark partner={partner} /></li>)}
      </ul>
    </div>
  </div>;
}
