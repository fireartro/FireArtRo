import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import film from '../../data/heroFilm.json';
import { getHeroFilmCue, getHeroCuePose, getHeroEchoPose } from './heroFilmClock';
import '../../styles/hero-kinetic-titles.css';

// Typography stays outside the cropped video surface and follows the media clock.
// No animation library, per-frame React renders, or second media download.
export default function HeroKineticTitles({ videoRef, enabled, source }) {
  const [host, setHost] = useState(null);
  const overlayRef = useRef(null);

  useEffect(() => {
    setHost(enabled ? videoRef.current?.closest('.nr-hero') || null : null);
  }, [videoRef, enabled, source]);

  useEffect(() => {
    const video = videoRef.current;
    const overlay = overlayRef.current;
    if (!enabled || !host || !video || !overlay) return undefined;
    const nodes = new Map([...overlay.children].map(node => [node.dataset.cue, {
      node,
      lines: [...node.querySelectorAll('.hero-kinetic__line')].map(line => ({
        lead: line.querySelector('.hero-kinetic__lead'),
        echoes: [...line.querySelectorAll('.hero-kinetic__echo')],
      })),
    }]));
    let active = null;
    let frame = null;
    let disposed = false;
    let lastTime = null;

    const draw = () => {
      if (disposed) return;
      const time = video.currentTime;
      if (time === lastTime) return;
      lastTime = time;
      const cue = getHeroFilmCue(time);
      if (active !== cue?.id) {
        if (active) nodes.get(active).node.style.visibility = 'hidden';
        active = cue?.id || null;
        if (active) nodes.get(active).node.style.visibility = 'visible';
      }
      if (!cue) return;
      nodes.get(cue.id).lines.forEach(({ lead, echoes }, i) => {
        const pose = getHeroCuePose(cue, time % film.duration, i);
        lead.style.opacity = String(pose.opacity);
        lead.style.transform = `translate3d(${pose.x}%,${pose.y}%,0) scale(${pose.scale})`;
        echoes.forEach((echo, j) => {
          if (cue.motion === 'stack') {
            const echoPose = getHeroEchoPose(cue, time % film.duration, Number(echo.dataset.row));
            echo.style.opacity = String(echoPose.opacity);
            echo.style.transform = `translate3d(${echoPose.x}%,${echoPose.y}%,0)`;
          } else {
            echo.style.opacity = String(pose.opacity * pose.echo * (.35 / (j + 1)));
            echo.style.transform = `translate3d(${pose.x}%,${pose.y - (j + 1) * 36 * pose.echo}%,0)`;
          }
        });
      });
    };
    const stop = () => {
      if (frame !== null) window.cancelAnimationFrame(frame);
      frame = null;
    };
    const tick = () => {
      frame = null;
      draw();
      if (!disposed && !video.paused && !video.ended && document.visibilityState !== 'hidden') {
        frame = window.requestAnimationFrame(tick);
      }
    };
    const start = () => { stop(); tick(); };
    const visibility = () => {
      if (document.visibilityState === 'hidden') stop();
      else if (!video.paused) start();
    };

    // Measure only on layout changes. Keep the animated words clear of real CTA
    // bounds and the bottom social rail, even with a taller CMS heading.
    const layout = () => {
      const hero = host.getBoundingClientRect();
      const content = host.querySelector('.nr-hero__content');
      const actions = host.querySelector('.nr-hero__actions') || content;
      if (!actions || !hero.width || !hero.height) return;
      const actionBox = actions.getBoundingClientRect();
      const stacked = hero.width <= 900 || hero.height > hero.width;
      if (stacked) {
        const startY = Math.max(actionBox.bottom - hero.top + 28, hero.height * .59);
        const available = hero.height - 76 - startY;
        overlay.style.setProperty('--kinetic-top', `${startY}px`);
        overlay.style.setProperty('--kinetic-height', `${Math.max(0, available)}px`);
        overlay.style.setProperty('--kinetic-size', `${Math.max(0, Math.min(hero.width * .10, 74, available / 4.6))}px`);
        overlay.style.display = available < 55 ? 'none' : '';
      } else {
        overlay.style.removeProperty('--kinetic-top');
        overlay.style.removeProperty('--kinetic-height');
        overlay.style.removeProperty('--kinetic-size');
        overlay.style.display = '';
      }
    };
    const resizeObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(layout) : null;
    resizeObserver?.observe(host);
    const content = host.querySelector('.nr-hero__content');
    if (content) resizeObserver?.observe(content);
    window.addEventListener('resize', layout);
    video.addEventListener('playing', start);
    ['pause', 'waiting', 'ended', 'emptied'].forEach(event => video.addEventListener(event, stop));
    ['seeked', 'timeupdate', 'loadeddata'].forEach(event => video.addEventListener(event, draw));
    document.addEventListener('visibilitychange', visibility);
    layout();
    draw();
    if (!video.paused) start();
    return () => {
      disposed = true;
      stop();
      resizeObserver?.disconnect();
      window.removeEventListener('resize', layout);
      video.removeEventListener('playing', start);
      ['pause', 'waiting', 'ended', 'emptied'].forEach(event => video.removeEventListener(event, stop));
      ['seeked', 'timeupdate', 'loadeddata'].forEach(event => video.removeEventListener(event, draw));
      document.removeEventListener('visibilitychange', visibility);
      nodes.forEach(({ node }) => { node.style.visibility = 'hidden'; });
    };
  }, [videoRef, enabled, source, host]);

  if (!enabled || !host) return null;
  return createPortal(
    <div ref={overlayRef} className="hero-kinetic" aria-hidden="true">
      {film.cues.map(cue => (
        <div key={cue.id} data-cue={cue.id} data-motion={cue.motion} className="hero-kinetic__cue" style={{ visibility: 'hidden', '--cue-scale': cue.size || 1, '--cue-accent': cue.accent || '#f6f1e8' }}>
          {cue.lines.map((line, i) => (
            <div key={line} className={`hero-kinetic__line${i ? ' hero-kinetic__line--accent' : ''}`}>
              {(cue.motion === 'stack' ? [-2, -1, 1, 2] : [-2, -1]).map(row => (
                <span key={row} data-row={row} className={`hero-kinetic__echo${cue.motion === 'stack' && Math.abs(row) === 1 ? ' hero-kinetic__echo--solid' : ''}`}>{line}</span>
              ))}
              <span className="hero-kinetic__lead">{line}</span>
            </div>
          ))}
        </div>
      ))}
    </div>, host,
  );
}
