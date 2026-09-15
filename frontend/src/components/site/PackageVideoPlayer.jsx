import { useEffect, useRef, useState } from 'react';
import { Play, Film } from 'lucide-react';
import { useReducedMotion } from 'framer-motion';
import { collectPackageVideos } from '@/lib/categoryNavigation';
import { readCookieConsent, COOKIE_CONSENT_UPDATED_EVENT, OPEN_COOKIE_SETTINGS_EVENT } from './CookieConsent';
import '@/styles/package-video-playlist.css';

export function packageVideoSource(value = '') {
  try {
    const url = new URL(value, 'https://fireart.ro');
    if (!['https:', 'http:'].includes(url.protocol)) return null;
    const host = url.hostname.replace(/^www\./, '');
    let id = '';
    if (host === 'youtu.be') id = url.pathname.split('/')[1];
    if (['youtube.com', 'm.youtube.com', 'youtube-nocookie.com'].includes(host)) {
      const parts = url.pathname.split('/').filter(Boolean);
      id = parts[0] === 'watch' ? url.searchParams.get('v') : ['embed', 'shorts', 'live'].includes(parts[0]) ? parts[1] : '';
    }
    if (/^[a-zA-Z0-9_-]{11}$/.test(id)) return { type: 'youtube', id, poster: `https://img.youtube.com/vi/${id}/hqdefault.jpg` };
    if (/\.(mp4|webm|mov)$/i.test(url.pathname)) return { type: 'file', src: value };
  } catch { /* Invalid CMS media stays a labelled unavailable preview. */ }
  return null;
}

const hasVideoConsent = () => {
  const choice = readCookieConsent();
  return !!(choice?.marketing && choice.expiresAt && Date.parse(choice.expiresAt) > Date.now());
};

function Poster({ src, fallback, alt, eager = false }) {
  const [failed, setFailed] = useState(0);
  if (failed > 1 || (!src && (!fallback || failed))) return <span className="nr-video-placeholder" aria-label={alt}><Film aria-hidden="true" /></span>;
  return <img src={failed ? fallback : src || fallback} alt={alt} loading={eager ? 'eager' : 'lazy'} decoding="async" onError={() => setFailed(failed + 1)} />;
}

export default function PackageVideoPlayer({ item, fallback, label, changing }) {
  const videos = collectPackageVideos(item);
  const signature = videos.join('\n');
  const [selected, setSelected] = useState(videos[0] || '');
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);
  const [consent, setConsent] = useState(hasVideoConsent);
  const buttons = useRef([]);
  const reduced = useReducedMotion();
  const activeUrl = videos.includes(selected) ? selected : videos[0] || '';
  const source = packageVideoSource(activeUrl);
  const canPlay = source && !failed;
  const showPlayer = playing && canPlay && !changing && (source.type !== 'youtube' || consent);

  useEffect(() => { setSelected(videos[0] || ''); setPlaying(false); setFailed(false); }, [signature]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (changing) setPlaying(false); }, [changing]);
  useEffect(() => {
    let expiryTimer;
    const sync = () => {
      window.clearTimeout(expiryTimer);
      const allowed = hasVideoConsent();
      setConsent(allowed);
      if (!allowed) setPlaying(false);
      if (allowed) {
        const remaining = Date.parse(readCookieConsent().expiresAt) - Date.now();
        // Recheck long-lived choices daily without overflowing the browser timer.
        expiryTimer = window.setTimeout(sync, Math.min(Math.max(remaining, 0), 86_400_000));
      }
    };
    window.addEventListener(COOKIE_CONSENT_UPDATED_EVENT, sync);
    window.addEventListener('storage', sync);
    window.addEventListener('focus', sync);
    sync();
    return () => {
      window.clearTimeout(expiryTimer);
      window.removeEventListener(COOKIE_CONSENT_UPDATED_EVENT, sync);
      window.removeEventListener('storage', sync);
      window.removeEventListener('focus', sync);
    };
  }, []);

  const choose = (url, openSettings = false) => {
    setSelected(url);
    setFailed(false);
    const next = packageVideoSource(url);
    const allowed = hasVideoConsent();
    setConsent(allowed);
    setPlaying(!!next && (next.type !== 'youtube' || allowed));
    if (next?.type === 'youtube' && !allowed && openSettings) window.dispatchEvent(new Event(OPEN_COOKIE_SETTINGS_EVENT));
  };
  const onKey = (event, index) => {
    let next;
    if (['ArrowRight', 'ArrowDown'].includes(event.key)) next = (index + 1) % videos.length;
    if (['ArrowLeft', 'ArrowUp'].includes(event.key)) next = (index - 1 + videos.length) % videos.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = videos.length - 1;
    if (next !== undefined) { event.preventDefault(); buttons.current[next]?.focus(); }
  };

  return <div className="nr-package-cinema">
    <figure className="nr-package-stage__media" data-testid="package-media">
      {showPlayer ? source.type === 'youtube' ? <iframe
        key={activeUrl} src={`https://www.youtube-nocookie.com/embed/${source.id}?autoplay=${reduced ? 0 : 1}&rel=0&playsinline=1`}
        title={`Video demonstrativ pentru pachetul ${item.title}`}
        allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin"
      /> : <video key={activeUrl} src={source.src} controls autoPlay={!reduced} playsInline preload="metadata" onError={() => { setPlaying(false); setFailed(true); }} /> : <>
        <Poster key={activeUrl || fallback} src={source?.poster} fallback={fallback} alt={`Previzualizare pentru ${item.title}`} eager />
        {canPlay && <button type="button" className="nr-package-video-trigger" onClick={() => choose(activeUrl, true)} aria-label={`Vezi videoclipul pachetului ${item.title}`}>
          <Play aria-hidden="true" fill="currentColor" /><span>{source.type === 'youtube' && !consent ? 'Activează videoclipul' : 'Vezi clipul'}</span>
        </button>}
        {activeUrl && !canPlay && <p className="nr-video-unavailable" role="status">Acest videoclip este momentan indisponibil.</p>}
        <figcaption>{label}</figcaption>
      </>}
    </figure>
    {videos.length > 0 && <section className="nr-video-playlist" aria-label={`Videoclipuri pentru ${item.title}`}>
      <header><span>Vezi spectacolul</span><small>Alege un clip</small></header>
      <div data-testid="package-video-playlist" className="nr-video-playlist__items">
        {videos.map((url, index) => {
          const video = packageVideoSource(url);
          const title = index === 0 ? 'Video principal' : `Video ${index + 1}`;
          return <button key={url} type="button" ref={node => { buttons.current[index] = node; }} aria-pressed={url === activeUrl}
            aria-label={`${title} — ${item.title}`} onClick={() => choose(url)} onKeyDown={event => onKey(event, index)}>
            <span className="nr-video-playlist__picture"><Poster src={video?.poster} fallback={fallback} alt="" /><Play aria-hidden="true" fill="currentColor" /></span>
            <span className="nr-video-playlist__label">{title}</span>
          </button>;
        })}
      </div>
      {source?.type === 'youtube' && !consent && <p className="nr-video-consent">Videoclipurile YouTube se încarcă după activarea cookies de marketing.</p>}
    </section>}
  </div>;
}
