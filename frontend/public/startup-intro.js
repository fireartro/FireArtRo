/* First-paint brand reveal, waiting only for the actual first hero. */
(() => {
    const html = document.documentElement;
    const intro = document.getElementById('fireart-intro');
    if (!intro || !html.dataset.fireartIntro) { intro?.remove(); return; }
    const root = document.getElementById('root');
    const footage = intro.querySelector('video');
    const poster = intro.querySelector('picture');
    const hidePoster = () => { if (poster) poster.hidden = true; };
    // Keep the original single .46-opacity film once frames are playing;
    // the responsive still is only its initial loading fallback.
    footage?.addEventListener?.('playing', hidePoster);
    const playFootage = () => {
        if (!footage || document.hidden || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        footage.loop = true;
        footage.muted = true;
        footage.play().catch(() => {});
    };
    playFootage();
    const skip = intro.querySelector('button');
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const firstHero = document.querySelector?.('video[data-hero-initial-film]');
    const markPrimed = () => {
        if (!firstHero || firstHero.readyState < 3 || motion.matches || navigator.connection?.saveData) return;
        firstHero.dataset.heroPrimed = 'true';
        firstHero.classList.add('hero-montage__video--visible');
        firstHero.removeEventListener('canplay', markPrimed);
    };
    // Source selection precedes the application bundle, while the existing
    // reveal and player retain control of playback and film transitions.
    if (firstHero && !document.hidden && !motion.matches && !navigator.connection?.saveData
        && firstHero.canPlayType('video/mp4; codecs="avc1.640028"')) {
        try {
            const sources = JSON.parse(firstHero.getAttribute('data-hero-initial-sources'));
            const format = window.innerWidth <= window.innerHeight ? 'portrait' : 'wide';
            const connection = navigator.connection || {};
            const pixels = Math.max(window.innerWidth, window.innerHeight) * (window.devicePixelRatio || 1);
            const slow = ['slow-2g', '2g', '3g'].includes(connection.effectiveType);
            const quality = !slow && pixels >= 3200 && format !== 'portrait' ? 'uhd'
                : !slow && pixels > 2000 ? 'retina' : 'hd';
            const source = sources[format]?.[quality];
            if (typeof source === 'string' && /^\/media\/hero-film-[a-z0-9-]+\.mp4\?v=[a-z0-9-]+$/.test(source)) {
                const heroPoster = document.querySelector('#acasa picture[data-hero-poster] img');
                if (heroPoster?.currentSrc) firstHero.poster = heroPoster.currentSrc;
                firstHero.muted = true;
                firstHero.preload = 'auto';
                firstHero.dataset.mediaVariant = format;
                firstHero.dataset.mediaQuality = quality;
                firstHero.addEventListener('canplay', markPrimed);
                firstHero.src = source;
                markPrimed();
            }
        } catch { /* React retains its ordinary source-selection fallback. */ }
    }
    const started = window.__fireartIntroStarted ?? performance.now();
    const minimumDuration = 1300;
    let closed = false;
    let leaving = false;
    let routeStarted = null;
    let homepage = false;
    let mediaTimer;
    let exitTimer;
    let removeTimer;
    let skipTimer;
    let stalledTimer;
    let footageTime = -1;
    let footageMoved = performance.now();
    const footageTimer = footage ? setInterval(() => {
        if (document.hidden || motion.matches) return;
        if (footage.currentTime !== footageTime) {
            footageTime = footage.currentTime;
            footageMoved = performance.now();
        } else if (footage.readyState >= 2 && performance.now() - footageMoved > 1200) {
            footage.pause();
            playFootage();
            footageMoved = performance.now();
        }
    }, 350) : null;
    root?.setAttribute('inert', '');
    clearInterval(window.__fireartIntroSafety);
    // CSS overflow alone does not stop touch overscroll on WebKit. Keep the
    // first-paint guard until the overlay has actually left, not just faded.
    const preventScroll = window.__fireartIntroScrollGuard || (event => {
        if (event.type === 'keydown' && event.key === ' ' && event.target?.closest?.('#fireart-intro button')) return;
        if (event.type === 'keydown' && !['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(event.key)) return;
        if (event.cancelable) event.preventDefault();
    });
    const scrollEvents = ['wheel', 'touchmove', 'keydown'];
    scrollEvents.forEach(type => document.addEventListener(type, preventScroll, { capture: true, passive: false }));

    const restorePage = () => {
        root?.removeAttribute('inert');
        if (intro.contains(document.activeElement)) {
            document.getElementById('main-content')?.focus({ preventScroll: true });
        }
    };
    const cleanup = () => {
        if (closed) return;
        closed = true;
        clearInterval(mediaTimer);
        clearInterval(footageTimer);
        clearTimeout(exitTimer);
        clearTimeout(removeTimer);
        clearTimeout(skipTimer);
        clearTimeout(stalledTimer);
        clearTimeout(safetyTimer);
        footage?.pause();
        ['loadeddata', 'canplay', 'canplaythrough', 'error'].forEach(type => document.removeEventListener(type, checkMedia, true));
        footage?.removeEventListener('canplay', playFootage);
        footage?.removeEventListener?.('playing', hidePoster);
        firstHero?.removeEventListener('canplay', markPrimed);
        window.removeEventListener('pageshow', onPageShow);
        document.removeEventListener('visibilitychange', onVisibility);
        motion.removeEventListener?.('change', onMotion);
        skip.removeEventListener('click', onSkip);
        scrollEvents.forEach(type => document.removeEventListener(type, preventScroll, true));
        delete window.__fireartIntroScrollGuard;
        restorePage();
        delete html.dataset.fireartIntro;
        intro.remove();
        delete window.__fireartIntro;
        window.dispatchEvent(new Event('fireart:intro-dismissed'));
    };
    const finish = (immediate = false) => {
        if (closed) return;
        if (immediate) { cleanup(); return; }
        if (leaving) return;
        leaving = true;
        clearInterval(mediaTimer);
        const delay = motion.matches ? 0 : Math.max(0, minimumDuration - (performance.now() - started));
        exitTimer = setTimeout(() => {
            if (motion.matches) { cleanup(); return; }
            html.dataset.fireartIntro = 'leaving';
            const fade = Math.max(0, Math.min(200, 1500 - (performance.now() - started)));
            intro.style?.setProperty('transition-duration', `${fade}ms`);
            removeTimer = setTimeout(cleanup, fade);
        }, delay);
    };
    const checkMedia = () => {
        if (closed || leaving || routeStarted === null) return;
        if (!homepage) { intro.dataset.mediaReady = 'true'; finish(); return; }
        const hero = document.getElementById('acasa');
        const video = hero?.querySelector('video');
        const poster = hero?.querySelector('.hero-media-surface');
        const imageReady = poster?.tagName === 'IMG' && poster.complete && poster.naturalWidth > 0;
        const playback = hero?.querySelector('[data-hero-playback]')?.dataset.heroPlayback;
        const connection = navigator.connection;
        const posterOnly = motion.matches || connection?.saveData || playback === 'poster';
        const expectsVideo = playback === 'video' && !posterOnly;
        const elapsed = performance.now() - routeStarted;
        // HAVE_FUTURE_DATA means playback can advance. Mobile browsers can
        // buffer a healthy stream without ever promising canplaythrough.
        const videoReady = video && video.readyState >= 3 && !video.error;
        const stillReady = posterOnly && poster?.tagName === 'VIDEO' && poster.readyState >= 2;
        const posterFallback = imageReady && (posterOnly || (!expectsVideo && !video && elapsed > 1500) || video?.error || (video?.readyState >= 4 && elapsed > 1500));
        const mediaFailed = poster?.complete && !imageReady && (video?.error || (!expectsVideo && !video)) && elapsed > 1500;
        if (videoReady || stillReady || posterFallback || mediaFailed) {
            intro.dataset.mediaReady = 'true';
            finish();
        }
    };
    const onSkip = () => routeStarted === null ? window.location.reload() : finish(true);
    const onPageShow = event => { if (event.persisted) finish(true); };
    // Slow networks do not force an unfinished page into view. Offer a retry
    // if the app itself has not mounted; this is never an automatic reload.
    const safetyTimer = setTimeout(() => {
        if (closed || leaving || routeStarted !== null) return;
        skip.textContent = 'Reîncarcă pagina ↗';
        skip.hidden = false;
    }, Math.max(0, 12000 - (performance.now() - started)));
    window.__fireartIntro = {
        contentReady() { if (!closed) intro.dataset.contentReady = 'true'; },
        routeReady(path) {
            if (/^\/admin\/?$/.test(path)) { finish(true); return; }
            if (closed || routeStarted !== null) return;
            routeStarted = performance.now();
            homepage = path === '/';
            intro.dataset.routeReady = 'true';
            clearTimeout(safetyTimer);
            // A failed/blocked media request must never keep the page inert.
            // The hero retains its poster and continues its own recovery.
            stalledTimer = setTimeout(() => finish(), 8000);
            skip.textContent = 'Intră pe site ↗';
            skip.hidden = true;
            skipTimer = setTimeout(() => { if (!closed) skip.hidden = false; }, Math.max(0, minimumDuration - (performance.now() - started)));
            checkMedia();
            if (!closed && !leaving) mediaTimer = setInterval(checkMedia, 100);
        },
        dismiss() { finish(true); }
    };
    skip.addEventListener('click', onSkip);
    window.addEventListener('pageshow', onPageShow);

    function onVisibility() { if (!document.hidden) { playFootage(); checkMedia(); } }
    function onMotion() { checkMedia(); }
    document.addEventListener('visibilitychange', onVisibility);
    ['loadeddata', 'canplay', 'canplaythrough', 'error'].forEach(type => document.addEventListener(type, checkMedia, true));
    footage?.addEventListener('canplay', playFootage);
    motion.addEventListener?.('change', onMotion);
})();
