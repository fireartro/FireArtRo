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
  const [expanded, setExpanded] = useState(false);
  const [paused, setPaused] = useState(false);
  const list = expanded || reduceMotion;
  const toggleList = () => {
    setExpanded(value=>!value);
    requestAnimationFrame(()=>ref.current?.scrollIntoView({block:'start',behavior:'instant'}));
  };
  useEffect(() => {
    if (list) return undefined;
    const node = ref.current;
    const stage = node.querySelector('.fa-partner-scroll__stage');
    const heading = node.querySelector('header');
    const cards = [...node.querySelectorAll('.fa-partner')];
    const wide = window.matchMedia?.('(min-width:1200px) and (min-height:741px)') || { matches:false };
    let frame, visible = true, hovered = false, focused = false, last = 0;
    const reset = () => cards.forEach(card => { card.removeAttribute('style'); card.removeAttribute('aria-hidden'); card.querySelector('a').removeAttribute('tabindex'); });
    const draw = now => {
      frame = null;
      if (!visible || document.hidden || list || !wide.matches) { last = 0; return; }
      if (last && !paused && !hovered && !focused) turn.current += Math.min((now-last)/1000,.05)*.09;
      last = now;
      const box = node.getBoundingClientRect();
      const stageBox = stage.getBoundingClientRect();
      const text = heading.getBoundingClientRect();
      const progress = Math.max(0,Math.min(1,-box.top/Math.max(1,box.height-stageBox.height)));
      const protectedHeading = {left:text.left-stageBox.left-16,right:text.right-stageBox.left+16,top:text.top-stageBox.top-16,bottom:text.bottom-stageBox.top+16};
      const layout = partnerOrbitLayout(cards.length, stageBox.width, stageBox.height, turn.current + progress*Math.PI*1.7, progress, protectedHeading);
      layout.forEach(({index,x,y,scale,z,visible:shown,opacity}) => {
        const card=cards[index];
        card.style.transform=`translate(${x}px,${y}px) translate(-50%,-50%) scale(${scale})`;
        card.style.opacity=opacity;
        card.style.visibility=shown?'visible':'hidden';
        card.style.zIndex=Math.round((z+5)*10);
        card.setAttribute('aria-hidden',String(!shown));
        card.querySelector('a').tabIndex=shown?0:-1;
      });
      frame=requestAnimationFrame(draw);
    };
    const schedule = () => { if (!frame) frame=requestAnimationFrame(draw); };
    const update = () => { reset(); schedule(); };
    const enter = () => { hovered=true; };
    const leave = () => { hovered=false; };
    const focus = () => { focused=true; };
    const blur = event => { if(!node.contains(event.relatedTarget))focused=false; };
    const observer = typeof IntersectionObserver==='undefined'?null:new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;if(visible)schedule();});
    observer?.observe(node);
    wide.addEventListener?.('change',update);
    document.addEventListener('visibilitychange',schedule);
    node.addEventListener('pointerenter',enter);node.addEventListener('pointerleave',leave);
    node.addEventListener('focusin',focus);node.addEventListener('focusout',blur);
    schedule();
    return () => {
      cancelAnimationFrame(frame);observer?.disconnect();wide.removeEventListener?.('change',update);
      document.removeEventListener('visibilitychange',schedule);
      node.removeEventListener('pointerenter',enter);node.removeEventListener('pointerleave',leave);
      node.removeEventListener('focusin',focus);node.removeEventListener('focusout',blur);reset();
    };
  }, [partners, list, paused]);
  return <div ref={ref} className="fa-partner-scroll" data-testid="partner-scroll" data-layout={list?'grid':'orbit'}>
    <div className="fa-partner-scroll__stage">
      <header className="fa-partner-scroll__copy"><p className="fa-kicker">{copy.eyebrow}</p><h2 id="fa-partners-title">{title}</h2>
        <p>Parteneri & colaboratori</p>
        {!reduceMotion && <div className="fa-partner-scroll__controls">
          <button type="button" aria-controls="fireart-partner-marks" aria-expanded={expanded} onClick={toggleList}>{expanded?'Înapoi la orbită':`Vezi toți cei ${partners.length} parteneri`} <span aria-hidden="true">↗</span></button>
          {!expanded && <button type="button" aria-pressed={paused} aria-label={paused?'Pornește animația siglelor':'Oprește animația siglelor'} onClick={()=>setPaused(value=>!value)}>{paused?'▷':'Ⅱ'}</button>}
        </div>}
        {copy.ctaLabel && <Link className="fa-line-link" to={copy.ctaHref}>{copy.ctaLabel}</Link>}
      </header>
      <ul id="fireart-partner-marks" className="fa-partner-scroll__marks" aria-label="Parteneri și colaboratori FireArtRo">
        {partners.map(partner => <li className="fa-partner" key={partner.id} data-partner-id={partner.id}><Mark partner={partner} /></li>)}
      </ul>
    </div>
  </div>;
}
