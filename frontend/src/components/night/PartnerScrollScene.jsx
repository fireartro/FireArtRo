import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { partnerDestination } from '@/data/partnerCatalog';
import { partnerOrbitLayout } from './partnerOrbitLayout';

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
  const turn = useRef(0);
  const list = reduceMotion;
  useEffect(() => {
    if (list) return undefined;
    const node = ref.current;
    const stage = node.querySelector('.fa-partner-scroll__stage');
    const cards = [...node.querySelectorAll('.fa-partner')];
    const wide = window.matchMedia?.('(min-width:1200px) and (min-height:741px)') || { matches:false };
    let frame, visible = true, focused = false, last = 0, scrollTurn = null;
    const reset = () => cards.forEach(card => { card.removeAttribute('style'); card.removeAttribute('aria-hidden'); card.querySelector('a').removeAttribute('tabindex'); });
    const draw = now => {
      frame = null;
      if (!visible || document.hidden || list || !wide.matches) { last = 0; return; }
      const elapsed=last?Math.min((now-last)/1000,.05):0;
      if (!focused) turn.current += elapsed*.065;
      last = now;
      const box = node.getBoundingClientRect();
      const stageBox = stage.getBoundingClientRect();
      const progress = Math.max(0,Math.min(1,-box.top/Math.max(1,box.height-stageBox.height)));
      const target=progress*Math.PI*1.7;
      // A fast scroll or a slow frame must not fling a card across the scene.
      const step=scrollTurn===null?0:(target-scrollTurn)*(1-Math.exp(-elapsed*7));
      const limit=elapsed*.55;
      scrollTurn=scrollTurn===null?target:scrollTurn+Math.max(-limit,Math.min(limit,step));
      const layout = partnerOrbitLayout(cards.length, stageBox.width, stageBox.height, turn.current + scrollTurn);
      layout.forEach(({index,x,y,scale,z}) => {
        const card=cards[index];
        card.style.transform=`translate(${x}px,${y}px) translate(-50%,-50%) scale(${scale})`;
        card.style.zIndex=Math.round((z+5)*10);
      });
      frame=requestAnimationFrame(draw);
    };
    const schedule = () => { if (!frame) frame=requestAnimationFrame(draw); };
    const update = () => { reset(); schedule(); };
    const focus = () => { focused=true; };
    const blur = event => { if(!node.contains(event.relatedTarget))focused=false; };
    const observer = typeof IntersectionObserver==='undefined'?null:new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;if(visible)schedule();});
    observer?.observe(node);
    wide.addEventListener?.('change',update);
    document.addEventListener('visibilitychange',schedule);
    node.addEventListener('focusin',focus);node.addEventListener('focusout',blur);
    schedule();
    return () => {
      cancelAnimationFrame(frame);observer?.disconnect();wide.removeEventListener?.('change',update);
      document.removeEventListener('visibilitychange',schedule);
      node.removeEventListener('focusin',focus);node.removeEventListener('focusout',blur);reset();
    };
  }, [partners, list]);
  return <div ref={ref} className="fa-partner-scroll" data-testid="partner-scroll" data-layout={list?'grid':'orbit'}>
    <div className="fa-partner-scroll__stage">
      <header className="fa-partner-scroll__copy"><p className="fa-kicker">{copy.eyebrow}</p><h2 id="fa-partners-title">{title}</h2>
        <p>Parteneri & colaboratori</p>
        {copy.ctaLabel && <Link className="fa-line-link" to={copy.ctaHref}>{copy.ctaLabel}</Link>}
      </header>
      <ul id="fireart-partner-marks" className="fa-partner-scroll__marks" aria-label="Parteneri și colaboratori FireArtRo">
        {partners.map(partner => <li className="fa-partner" key={partner.id} data-partner-id={partner.id}><Mark partner={partner} /></li>)}
      </ul>
    </div>
  </div>;
}
