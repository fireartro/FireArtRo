import { useEffect, useRef, useState } from 'react';
import { Play, Film } from 'lucide-react';
import useReducedMotion from "@/hooks/useReducedMotion";
import { collectPackageVideos } from '@/lib/categoryNavigation';
import { OPEN_COOKIE_SETTINGS_EVENT, readCookieConsent, useCookieConsent } from '@/lib/cookieConsent';
import { frameContainerStyle } from '@/lib/imageFrame';
import { allowedGoogleMedia, isOptionalGoogleMedia, LOCAL_MEDIA_FALLBACK } from '@/lib/optionalGoogleMedia';
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

const needsConsent = source => source?.type === 'youtube' || isOptionalGoogleMedia(source?.src);

function Poster({ src, fallback, alt, eager = false }) {
  const [failed, setFailed] = useState(0);
  if (failed > 1 || (!src && (!fallback || failed))) return <span className="nr-video-placeholder" aria-label={alt}><Film aria-hidden="true" /></span>;
  return <img className="image-frame-media" src={failed ? fallback : src || fallback} alt={alt} loading={eager ? 'eager' : 'lazy'} decoding="async" onError={() => setFailed(failed + 1)} />;
}

export default function PackageVideoPlayer({ item, fallback, label, changing }) {
  const videos = collectPackageVideos(item);
  const signature = videos.join('\n');
  const [selected, setSelected] = useState(videos[0] || '');
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);
  const consent = useCookieConsent()?.marketing === true;
  const buttons = useRef([]);
  const reduced = useReducedMotion();
  const activeUrl = videos.includes(selected) ? selected : videos[0] || '';
  const source = packageVideoSource(activeUrl);
  const optional = needsConsent(source);
  const canPlay = source && !failed;
  const showPlayer = playing && canPlay && !changing && (!optional || consent);
  const safeFallback = allowedGoogleMedia(fallback, consent, LOCAL_MEDIA_FALLBACK);
  const poster = item.mediaSelection === 'manual' && item.imageMediaId
    ? safeFallback : allowedGoogleMedia(source?.poster, consent);

  useEffect(() => { setSelected(videos[0] || ''); setPlaying(false); setFailed(false); }, [signature]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (changing) setPlaying(false); }, [changing]);
  useEffect(() => { if (optional && !consent) setPlaying(false); }, [optional, consent]);

  const choose = (url, openSettings = false) => {
    setSelected(url);
    setFailed(false);
    const next = packageVideoSource(url);
    const permitted = !needsConsent(next) || readCookieConsent()?.marketing === true;
    setPlaying(Boolean(next) && permitted);
    if (!permitted && openSettings) window.dispatchEvent(new Event(OPEN_COOKIE_SETTINGS_EVENT));
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
    <figure className="nr-package-stage__media" data-testid="package-media" data-image-frame={!showPlayer && item.imageFrame ? 'package' : undefined} style={!showPlayer ? frameContainerStyle(item.imageFrame) : undefined}>
      {showPlayer ? source.type === 'youtube' ? <iframe
        key={activeUrl} src={`https://www.youtube-nocookie.com/embed/${source.id}?autoplay=${reduced ? 0 : 1}&rel=0&playsinline=1`}
        title={`Video demonstrativ pentru pachetul ${item.title}`}
        allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin"
      /> : <video key={activeUrl} src={source.src} controls autoPlay={!reduced} playsInline preload="metadata" onError={() => { setPlaying(false); setFailed(true); }} /> : <>
        <Poster key={`${activeUrl}-${poster}-${safeFallback}`} src={poster} fallback={safeFallback} alt={`Previzualizare pentru ${item.title}`} eager />
        {canPlay && <button type="button" className="nr-package-video-trigger" onClick={() => choose(activeUrl, true)} aria-label={`Vezi videoclipul pachetului ${item.title}`}>
          <Play aria-hidden="true" fill="currentColor" /><span>{optional && !consent ? 'Activează videoclipul' : 'Vezi clipul'}</span>
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
            <span className="nr-video-playlist__picture"><Poster key={`${consent}-${safeFallback}`} src={allowedGoogleMedia(video?.poster, consent)} fallback={safeFallback} alt="" /><Play aria-hidden="true" fill="currentColor" /></span>
            <span className="nr-video-playlist__label">{title}</span>
          </button>;
        })}
      </div>
      {optional && !consent && <p className="nr-video-consent">Videoclipurile externe se încarcă după ce permiți conținutul extern.</p>}
    </section>}
  </div>;
}
