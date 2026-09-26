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

    // Choreographed drones and falling firework trails share one projected
    // space. Glow sprites are drawn once and reused throughout the scene.
    let blueGlow;
    let goldGlow;
    const rays = Array.from({ length: 100 }, (_, index) => {
        const y = 1 - (index / 99) * 2;
        const radius = Math.sqrt(1 - y * y);
        const angle = index * 2.39996323;
        return { x: Math.cos(angle) * radius, y, z: Math.sin(angle) * radius, seed: (index * 0.618034) % 1 };
    });
    const drones = Array.from({ length: 216 }, (_, index) => {
        const angle = (index % 72) / 72 * Math.PI * 2;
        const ring = Math.floor(index / 72);
        return { angle, ring, seed: (index * .618034) % 1 };
    });
    const centerY = () => height * (width < 600 ? .42 : height < 500 ? .39 : .44);
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
        const rx = width < 600 ? 127 : Math.min(width * .14, 194);
        const ry = height < 500 ? 69 : width < 600 ? 85 : 112;
        const distance = Math.hypot((point.x - width / 2) / rx, (point.y - centerY()) / ry);
        return clamp((distance - .88) * 2.5);
    };
    const draw = time => {
        if (closed || !intro.isConnected || !context) return;
        if (document.hidden) return;
        if (time - lastFrame < 25 && !motion.matches) { frame = requestAnimationFrame(draw); return; }
        lastFrame = time;
        const seconds = motion.matches ? 1.8 : Math.max(0, (time - started) / 1000);
        const size = Math.min(width * .405, height * .35, 335);
        const rotation = seconds * .075 + .3;
        const assembly = motion.matches ? 1 : 1 - Math.pow(1 - clamp(seconds / 1.45), 3);
        context.clearRect(0, 0, width, height);
        // Sparse light dust establishes a much deeper plane behind the sculpture.
        for (let index = 0; index < 52; index++) {
            const x = ((index * .618034) % 1) * width;
            const y = (((index * .381966 + .13) + seconds * .002) % 1) * height;
            const alpha = .10 + .18 * (Math.sin(index + seconds * .4) + 1) / 2;
            context.fillStyle = `rgba(159,201,244,${alpha})`;
            context.beginPath(); context.arc(x, y, index % 6 === 0 ? 1.1 : .6, 0, Math.PI * 2); context.fill();
        }
        context.globalCompositeOperation = 'lighter';
        // Very fine guide traces make the drone formation read as a volume.
        for (let ring = 0; ring < 3; ring++) {
            const tilt = (ring - 1) * .68 + .30;
            context.beginPath();
            for (let step = 0; step <= 110; step++) {
                const angle = step / 110 * Math.PI * 2;
                const p = project(Math.cos(angle) * 1.04, Math.sin(angle) * Math.cos(tilt), Math.sin(angle) * Math.sin(tilt), rotation, size);
                if (step === 0) context.moveTo(p.x, p.y); else context.lineTo(p.x, p.y);
            }
            context.strokeStyle = 'rgba(88,163,255,.09)'; context.lineWidth = .65; context.stroke();
        }
        rays.forEach((ray, index) => {
            const phase = ((seconds + (index % 2 ? 1.1 : 2.0)) % 4.8) / 4.8;
            const expansion = .73 + .68 * Math.sin(phase * Math.PI * .65);
            const fade = Math.sin(phase * Math.PI) * .65 + .18;
            const drift = phase * phase * .30;
            const length = .24 + ray.seed * .32;
            const head = project(ray.x * expansion, ray.y * expansion + drift, ray.z * expansion, rotation * .65, size);
            const alpha = fade * clearCenter(head) * clamp(.83 - head.depth * .24);
            if (alpha < .015) return;
            context.lineWidth = (.65 + ray.seed * .45) * head.scale;
            for (let segment = 0; segment < 5; segment++) {
                const a = segment / 5;
                const b = (segment + 1) / 5;
                const fromRadius = expansion - length * (1 - a);
                const toRadius = expansion - length * (1 - b);
                const from = project(ray.x * fromRadius, ray.y * fromRadius + drift * a * a, ray.z * fromRadius, rotation * .65, size);
                const to = project(ray.x * toRadius, ray.y * toRadius + drift * b * b, ray.z * toRadius, rotation * .65, size);
                context.strokeStyle = `rgba(255,201,126,${alpha * b * .7})`;
                context.beginPath(); context.moveTo(from.x, from.y); context.lineTo(to.x, to.y); context.stroke();
            }
            glowAt(goldGlow, head.x, head.y, (4 + ray.seed * 4) * head.scale, alpha);
            context.fillStyle = `rgba(255,231,189,${alpha})`;
            context.beginPath(); context.arc(head.x, head.y, .9 * head.scale, 0, Math.PI * 2); context.fill();
        });
        const points = drones.map(drone => {
            const angle = drone.angle + seconds * .075;
            const radius = 1.04 + (1 - assembly) * (.16 + drone.seed * .65);
            const tilt = (drone.ring - 1) * .68 + .30;
            const wave = Math.sin(angle * 3 + seconds * .35) * .024;
            const x = Math.cos(angle) * radius;
            const y = Math.sin(angle) * Math.cos(tilt) * radius + wave;
            const z = Math.sin(angle) * Math.sin(tilt) * radius;
            return { ...project(x, y, z, rotation, size), seed: drone.seed };
        }).sort((a, b) => b.depth - a.depth);
        points.forEach(point => {
            const alpha = clamp(.82 - point.depth * .34) * clearCenter(point);
            const shimmer = .85 + .15 * Math.sin(seconds * 1.1 + point.seed * 10);
            glowAt(blueGlow, point.x, point.y, (8 + point.seed * 3) * point.scale, alpha * shimmer);
            context.fillStyle = `rgba(213,239,255,${alpha})`;
            context.beginPath(); context.arc(point.x, point.y, 1.0 * point.scale, 0, Math.PI * 2); context.fill();
        });
        // A restrained optical flare anchors the sculpture to a distant stage.
        const flareY = height * .73;
        const flare = context.createRadialGradient(width / 2, flareY, 0, width / 2, flareY, size * .7);
        flare.addColorStop(0, 'rgba(82,164,255,.19)');
        flare.addColorStop(.2, 'rgba(22,119,255,.035)');
        flare.addColorStop(1, 'rgba(22,119,255,0)');
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
    if (context) { blueGlow = sprite('82,167,255'); goldGlow = sprite('255,191,109'); }
    window.addEventListener('resize', resize, { passive: true });
    document.addEventListener('visibilitychange', onVisibility);
    motion.addEventListener?.('change', onMotion);
    resize();
})();
