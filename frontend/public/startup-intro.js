/* First-paint brand reveal, waiting only for the actual first hero. */
(() => {
    const html = document.documentElement;
    const intro = document.getElementById('fireart-intro');
    if (!intro || !html.dataset.fireartIntro) { intro?.remove(); return; }
    const root = document.getElementById('root');
    const footage = intro.querySelector('video');
    if (footage && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) footage.play().catch(() => {});
    const skip = intro.querySelector('button');
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
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
        clearTimeout(exitTimer);
        clearTimeout(removeTimer);
        clearTimeout(skipTimer);
        clearTimeout(safetyTimer);
        footage?.pause();
        document.removeEventListener('canplaythrough', checkMedia, true);
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
        // A decoded first frame (HAVE_CURRENT_DATA) is not enough on slow
        // networks. Wait for HAVE_ENOUGH_DATA; never replace this with a timer.
        const videoReady = video && video.readyState >= 4 && !video.error;
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

    function onVisibility() { if (!document.hidden) checkMedia(); }
    function onMotion() { checkMedia(); }
    document.addEventListener('visibilitychange', onVisibility);
    document.addEventListener('canplaythrough', checkMedia, true);
    motion.addEventListener?.('change', onMotion);
})();
