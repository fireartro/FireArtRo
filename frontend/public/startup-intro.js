/* First-paint intro: native projected 3D, no media downloads or dependencies. */
(() => {
    const html = document.documentElement;
    const intro = document.getElementById('fireart-intro');
    if (!intro || !html.dataset.fireartIntro) { intro?.remove(); return; }
    const root = document.getElementById('root');
    const canvas = intro.querySelector('canvas');
    const skip = intro.querySelector('button');
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const started = window.__fireartIntroStarted || performance.now();
    let closed = false;
    let leaving = false;
    let routeStarted = null;
    let homepage = false;
    let mediaTimer;
    let exitTimer;
    let removeTimer;
    let frame;
    let context;
    let width = 0;
    let height = 0;
    let lastFrame = 0;
    root?.setAttribute('inert', '');
    clearTimeout(window.__fireartIntroSafety);

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
        clearTimeout(safetyTimer);
        window.removeEventListener('resize', resize);
        window.removeEventListener('pageshow', onPageShow);
        document.removeEventListener('visibilitychange', onVisibility);
        motion.removeEventListener?.('change', onMotion);
        skip.removeEventListener('click', onSkip);
        restorePage();
        delete html.dataset.fireartIntro;
        intro.remove();
        delete window.__fireartIntro;
    };
    const finish = (immediate = false) => {
        if (closed) return;
        if (immediate || motion.matches) { cleanup(); return; }
        if (leaving) return;
        leaving = true;
        clearInterval(mediaTimer);
        const delay = Math.max(0, 900 - (performance.now() - started));
        exitTimer = setTimeout(() => {
            html.dataset.fireartIntro = 'leaving';
            restorePage();
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
        if (videoReady || (imageReady && (posterOnly || elapsed > 3200)) || elapsed > 5000) {
            intro.dataset.mediaReady = 'true';
            finish();
        }
    };
    const onSkip = () => finish(true);
    const onPageShow = event => { if (event.persisted) finish(true); };
    // This deadline also covers a failed app bundle or an unreachable API.
    const safetyTimer = setTimeout(() => finish(true), Math.max(0, 12000 - (performance.now() - started)));
    window.__fireartIntro = {
        contentReady() { if (!closed) intro.dataset.contentReady = 'true'; },
        routeReady(path) {
            if (/^\/admin\/?$/.test(path)) { finish(true); return; }
            if (closed || routeStarted !== null) return;
            routeStarted = performance.now();
            homepage = path === '/';
            intro.dataset.routeReady = 'true';
            skip.hidden = false;
            checkMedia();
            if (!closed && !leaving) mediaTimer = setInterval(checkMedia, 100);
        },
        dismiss() { finish(true); }
    };
    skip.addEventListener('click', onSkip);
    window.addEventListener('pageshow', onPageShow);

    // Golden-angle spokes create a true spherical firework; orbiting blue
    // points echo a drone formation. Both use the same camera projection.
    const rays = Array.from({ length: 116 }, (_, index) => {
        const y = 1 - (index / 115) * 2;
        const radius = Math.sqrt(1 - y * y);
        const angle = index * 2.39996323;
        return { x: Math.cos(angle) * radius, y, z: Math.sin(angle) * radius, seed: (index * 0.618034) % 1 };
    });
    const drones = Array.from({ length: 150 }, (_, index) => {
        const angle = (index % 50) / 50 * Math.PI * 2;
        const ring = Math.floor(index / 50);
        return { angle, ring };
    });
    const project = (x, y, z, rotation, size) => {
        const rotatedX = x * Math.cos(rotation) + z * Math.sin(rotation);
        const rotatedZ = z * Math.cos(rotation) - x * Math.sin(rotation);
        const tiltedY = y * .94 - rotatedZ * .34;
        const depth = y * .34 + rotatedZ * .94;
        const perspective = 3.6 / (3.6 + depth);
        return { x: width / 2 + rotatedX * size * perspective, y: height * (width < 600 ? .42 : height < 500 ? .39 : .44) + tiltedY * size * perspective, depth, scale: perspective };
    };
    const draw = time => {
        if (closed || !intro.isConnected || !context) return;
        if (document.hidden) return;
        if (time - lastFrame < 32 && !motion.matches) { frame = requestAnimationFrame(draw); return; }
        lastFrame = time;
        const seconds = motion.matches ? 1.5 : (time - started) / 1000;
        const size = Math.min(width * .34, height * .32, 290);
        const rotation = seconds * .065 + .42;
        context.clearRect(0, 0, width, height);
        // Sparse light dust establishes a much deeper plane behind the sculpture.
        for (let index = 0; index < 42; index++) {
            const x = ((index * .618034) % 1) * width;
            const y = ((index * .381966 + .13) % 1) * height;
            const alpha = .08 + .12 * (Math.sin(index + seconds * .4) + 1) / 2;
            context.fillStyle = `rgba(159,201,244,${alpha})`;
            context.beginPath(); context.arc(x, y, index % 6 === 0 ? 1.1 : .6, 0, Math.PI * 2); context.fill();
        }
        rays.forEach(ray => {
            const pulse = .96 + .025 * Math.sin(seconds * .8 + ray.seed * 6);
            const outer = (1.02 + ray.seed * .27) * pulse;
            const inner = .64 + ray.seed * .18;
            const a = project(ray.x * inner, ray.y * inner, ray.z * inner, rotation, size);
            const b = project(ray.x * outer, ray.y * outer, ray.z * outer, rotation, size);
            // Keep a clear pocket around the brand, even for near-facing rays.
            const centerDistance = Math.hypot(b.x - width / 2, b.y - height * (width < 600 ? .42 : height < 500 ? .39 : .44));
            if (centerDistance < size * .50) return;
            const depthAlpha = (b.depth + 1.8) / 4;
            const gradient = context.createLinearGradient(a.x, a.y, b.x, b.y);
            gradient.addColorStop(0, 'rgba(220,161,76,0)');
            gradient.addColorStop(.68, `rgba(220,174,103,${.13 + depthAlpha * .3})`);
            gradient.addColorStop(1, `rgba(255,222,167,${.30 + depthAlpha * .5})`);
            context.strokeStyle = gradient;
            context.lineWidth = .65 * b.scale;
            context.beginPath(); context.moveTo(a.x, a.y); context.lineTo(b.x, b.y); context.stroke();
            context.fillStyle = `rgba(255,223,173,${.4 + depthAlpha * .45})`;
            context.beginPath(); context.arc(b.x, b.y, .9 * b.scale, 0, Math.PI * 2); context.fill();
        });
        const points = drones.map(drone => {
            const angle = drone.angle + seconds * .09;
            const x = Math.cos(angle) * 1.08;
            const z = Math.sin(angle) * 1.08;
            const tilt = (drone.ring - 1) * .75;
            return project(x, z * Math.sin(tilt), z * Math.cos(tilt), -rotation * .8, size);
        }).sort((a, b) => b.depth - a.depth);
        points.forEach(point => {
            const distance = Math.hypot(point.x - width / 2, point.y - height * (width < 600 ? .42 : height < 500 ? .39 : .44));
            if (distance < size * .53) return;
            const alpha = Math.max(.2, Math.min(1, .65 - point.depth * .25));
            context.fillStyle = `rgba(22,119,255,${alpha * .12})`;
            context.beginPath(); context.arc(point.x, point.y, 6 * point.scale, 0, Math.PI * 2); context.fill();
            context.fillStyle = `rgba(103,185,255,${alpha})`;
            context.beginPath(); context.arc(point.x, point.y, 1.6 * point.scale, 0, Math.PI * 2); context.fill();
            context.fillStyle = `rgba(223,243,255,${alpha})`;
            context.beginPath(); context.arc(point.x, point.y, .65 * point.scale, 0, Math.PI * 2); context.fill();
        });
        if (!motion.matches) frame = requestAnimationFrame(draw);
    };
    function resize() {
        if (!context || closed) return;
        width = window.innerWidth;
        height = window.innerHeight;
        const ratio = Math.min(window.devicePixelRatio || 1, width < 600 ? 1.5 : 2);
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
    window.addEventListener('resize', resize, { passive: true });
    document.addEventListener('visibilitychange', onVisibility);
    motion.addEventListener?.('change', onMotion);
    resize();
})();
