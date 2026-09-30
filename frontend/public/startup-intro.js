/* First-paint intro: native projected 3D, no media downloads or dependencies. */
(() => {
    const html = document.documentElement;
    const intro = document.getElementById('fireart-intro');
    if (!intro || !html.dataset.fireartIntro) { intro?.remove(); return; }
    const root = document.getElementById('root');
    const canvas = intro.querySelector('canvas');
    const skip = intro.querySelector('button');
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const started = window.__fireartIntroStarted ?? performance.now();
    const minimumDuration = 3000;
    let closed = false;
    let leaving = false;
    let routeStarted = null;
    let homepage = false;
    let mediaTimer;
    let exitTimer;
    let removeTimer;
    let skipTimer;
    let frame;
    let context;
    let width = 0;
    let height = 0;
    let lastFrame = 0;
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
        cancelAnimationFrame(frame);
        clearInterval(mediaTimer);
        clearTimeout(exitTimer);
        clearTimeout(removeTimer);
        clearTimeout(skipTimer);
        clearTimeout(safetyTimer);
        window.removeEventListener('resize', resize);
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
        const delay = Math.max(0, minimumDuration - (performance.now() - started));
        exitTimer = setTimeout(() => {
            if (motion.matches) { cleanup(); return; }
            html.dataset.fireartIntro = 'leaving';
            removeTimer = setTimeout(cleanup, 680);
        }, delay);
    };
    const checkMedia = () => {
        if (closed || leaving || routeStarted === null) return;
        if (!homepage) { intro.dataset.mediaReady = 'true'; finish(); return; }
        const hero = document.getElementById('acasa');
        const video = hero?.querySelector('video');
        const poster = hero?.querySelector('.hero-media-surface');
        const imageReady = poster?.tagName === 'IMG' && poster.complete && poster.naturalWidth > 0;
        const connection = navigator.connection;
        const posterOnly = motion.matches || connection?.saveData || /^(slow-2g|2g|3g)$/.test(connection?.effectiveType || '');
        const elapsed = performance.now() - routeStarted;
        const videoReady = video && video.readyState >= 2 && !video.paused;
        const posterFallback = imageReady && (posterOnly || (!video && elapsed > 3200) || video?.error || (video?.readyState >= 2 && elapsed > 3200));
        const mediaFailed = poster?.complete && !imageReady && (!video || video.error) && elapsed > 3200;
        if (videoReady || posterFallback || mediaFailed) {
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

    // Multicolour firework trails inhabit the same projected space. The logo
    // stays clear; six small glow sprites are reused for the entire scene.
    const fireworkPalette = ['141,211,255', '67,130,255', '255,94,191', '174,126,255', '104,236,190', '255,117,118'];
    let fireworkGlows = [];
    const rays = Array.from({ length: 144 }, (_, index) => {
        const y = 1 - (index / 143) * 2;
        const radius = Math.sqrt(1 - y * y);
        const angle = index * 2.39996323;
        return { x: Math.cos(angle) * radius, y, z: Math.sin(angle) * radius, seed: (index * 0.618034) % 1 };
    });
    const centerY = () => height * (width < 600 ? .42 : height < 500 ? .39 : .44);
    const sceneScale = () => Math.max(1, Math.min(width / 1440, height / 900));
    const clamp = value => Math.max(0, Math.min(1, value));
    const project = (x, y, z, rotation, size) => {
        const rotatedX = x * Math.cos(rotation) + z * Math.sin(rotation);
        const rotatedZ = z * Math.cos(rotation) - x * Math.sin(rotation);
        const tiltedY = y * .96 - rotatedZ * .28;
        const depth = y * .28 + rotatedZ * .96;
        const perspective = 4.5 / (4.5 + depth);
        return { x: width / 2 + rotatedX * size * perspective, y: centerY() + tiltedY * size * perspective, depth, scale: perspective };
    };
    const sprite = rgb => {
        const image = document.createElement('canvas');
        image.width = image.height = 48;
        const pen = image.getContext('2d');
        if (!pen) return null;
        const glow = pen.createRadialGradient(24, 24, 0, 24, 24, 24);
        glow.addColorStop(0, 'rgba(245,250,255,.95)');
        glow.addColorStop(.08, `rgba(${rgb},.8)`);
        glow.addColorStop(.24, `rgba(${rgb},.3)`);
        glow.addColorStop(.55, `rgba(${rgb},.06)`);
        glow.addColorStop(1, `rgba(${rgb},0)`);
        pen.fillStyle = glow; pen.fillRect(0, 0, 48, 48);
        return image;
    };
    const glowAt = (image, x, y, radius, alpha) => {
        if (!image || alpha <= 0) return;
        context.globalAlpha = clamp(alpha);
        context.drawImage(image, x - radius, y - radius, radius * 2, radius * 2);
        context.globalAlpha = 1;
    };
    const clearCenter = point => {
        const rx = width < 600 ? 127 : Math.min(width * .14, 194 * sceneScale());
        const ry = height < 500 ? 69 : width < 600 ? 85 : 112 * sceneScale();
        const distance = Math.hypot((point.x - width / 2) / rx, (point.y - centerY()) / ry);
        return clamp((distance - .88) * 2.5);
    };
    const draw = time => {
        if (closed || !intro.isConnected || !context) return;
        if (document.hidden) return;
        if (time - lastFrame < 25 && !motion.matches) { frame = requestAnimationFrame(draw); return; }
        lastFrame = time;
        const seconds = motion.matches ? 1.8 : Math.max(0, (time - started) / 1000);
        const scale = sceneScale();
        const size = Math.min(width * .405, height * .35, 335 * scale);
        const rotation = seconds * .075 + .3;
        context.clearRect(0, 0, width, height);
        // Sparse light dust establishes a much deeper plane behind the sculpture.
        for (let index = 0; index < 52; index++) {
            const x = ((index * .618034) % 1) * width;
            const y = (((index * .381966 + .13) + seconds * .002) % 1) * height;
            const alpha = .10 + .18 * (Math.sin(index + seconds * .4) + 1) / 2;
            context.fillStyle = `rgba(178,208,241,${alpha})`;
            context.beginPath(); context.arc(x, y, (index % 6 === 0 ? 1.1 : .6) * scale, 0, Math.PI * 2); context.fill();
        }
        context.globalCompositeOperation = 'lighter';
        rays.forEach((ray, index) => {
            const colorIndex = Math.floor(index / 24) % fireworkPalette.length;
            const color = fireworkPalette[colorIndex];
            const phase = ((seconds + (index % 3) * 1.45 + .85) % 6.4) / 6.4;
            const expansion = .76 + (.48 + ray.seed * .28) * Math.sin(phase * Math.PI * .65);
            const fade = Math.pow(Math.sin(phase * Math.PI), .7) * .82;
            const drift = phase * phase * .38;
            const length = .20 + ray.seed * .48;
            const head = project(ray.x * expansion, ray.y * expansion + drift, ray.z * expansion, rotation * .65, size);
            const alpha = fade * clearCenter(head) * clamp(.83 - head.depth * .24);
            if (alpha < .015) return;
            for (let segment = 0; segment < 7; segment++) {
                const a = segment / 7;
                const b = (segment + 1) / 7;
                const fromRadius = expansion - length * (1 - a);
                const toRadius = expansion - length * (1 - b);
                const from = project(ray.x * fromRadius, ray.y * fromRadius + drift * a * a, ray.z * fromRadius, rotation * .65, size);
                const to = project(ray.x * toRadius, ray.y * toRadius + drift * b * b, ray.z * toRadius, rotation * .65, size);
                context.lineWidth = (.25 + b * .8) * head.scale * scale;
                context.strokeStyle = `rgba(${color},${alpha * b * .82 * clearCenter(from)})`;
                context.beginPath(); context.moveTo(from.x, from.y); context.lineTo(to.x, to.y); context.stroke();
            }
            const shimmer = .83 + .17 * Math.sin(seconds * 2.1 + ray.seed * 16);
            glowAt(fireworkGlows[colorIndex], head.x, head.y, (6 + ray.seed * 6) * head.scale * scale, alpha * shimmer);
            context.fillStyle = `rgba(${color},${alpha})`;
            context.beginPath(); context.arc(head.x, head.y, (ray.seed > .85 ? 1.25 : .8) * head.scale * scale, 0, Math.PI * 2); context.fill();
            // A few elongated glints catch the light, never a full-screen flash.
            if (index % 19 === 0) {
                const glint = (3 + ray.seed * 4) * head.scale * scale;
                context.strokeStyle = `rgba(${color},${alpha * .55})`;
                context.lineWidth = .5;
                context.beginPath(); context.moveTo(head.x - glint, head.y); context.lineTo(head.x + glint, head.y);
                context.moveTo(head.x, head.y - glint * .6); context.lineTo(head.x, head.y + glint * .6); context.stroke();
            }
        });
        // A restrained optical flare anchors the sculpture to a distant stage.
        const flareY = height * .73;
        const flare = context.createRadialGradient(width / 2, flareY, 0, width / 2, flareY, size * .7);
        flare.addColorStop(0, 'rgba(141,211,255,.14)');
        flare.addColorStop(.2, 'rgba(67,130,255,.025)');
        flare.addColorStop(1, 'rgba(67,130,255,0)');
        context.save(); context.translate(0, flareY); context.scale(1, .14); context.translate(0, -flareY);
        context.fillStyle = flare; context.fillRect(width / 2 - size, flareY - size, size * 2, size * 2); context.restore();
        context.globalCompositeOperation = 'source-over';
        if (!motion.matches) frame = requestAnimationFrame(draw);
    };
    function resize() {
        if (!context || closed) return;
        width = window.innerWidth;
        height = window.innerHeight;
        const ratio = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.round(width * ratio);
        canvas.height = Math.round(height * ratio);
        context.setTransform(ratio, 0, 0, ratio, 0, 0);
        cancelAnimationFrame(frame);
        draw(performance.now());
    }
    function onVisibility() {
        cancelAnimationFrame(frame);
        if (!document.hidden) { checkMedia(); draw(performance.now()); }
    }
    function onMotion() { cancelAnimationFrame(frame); draw(performance.now()); checkMedia(); }
    try { context = canvas.getContext('2d', { alpha: true }); } catch { /* Static brand remains fully usable. */ }
    if (context) fireworkGlows = fireworkPalette.map(sprite);
    window.addEventListener('resize', resize, { passive: true });
    document.addEventListener('visibilitychange', onVisibility);
    motion.addEventListener?.('change', onMotion);
    resize();
})();
