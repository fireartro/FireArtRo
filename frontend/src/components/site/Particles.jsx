import { useEffect, useRef } from "react";

// Lightweight canvas spark field. Rendering pauses outside the viewport.
export const Particles = ({ density = 70, className }) => {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const colors = ["#3A86FF", "#176BFF", "#5CB7FF", "#5AA9FF", "#8F6BFF"];
    let width = 0;
    let height = 0;
    let particles = [];
    let raf = 0;
    let visible = true;
    let lastFrame = 0;

    const init = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.35);
      width = canvas.offsetWidth;
      height = canvas.offsetHeight;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const count = Math.max(18, Math.min(density, Math.floor(width / 14)));
      particles = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        r: Math.random() * 1.7 + 0.35,
        vy: -(Math.random() * 0.28 + 0.06),
        vx: (Math.random() - 0.5) * 0.14,
        a: Math.random() * 0.5 + 0.18,
        c: colors[Math.floor(Math.random() * colors.length)],
        tw: Math.random() * Math.PI * 2,
      }));
    };

    const draw = (time = 0) => {
      raf = requestAnimationFrame(draw);
      if (!visible || document.hidden || time - lastFrame < 33) return;
      lastFrame = time;
      ctx.clearRect(0, 0, width, height);

      for (const particle of particles) {
        particle.y += particle.vy;
        particle.x += particle.vx;
        particle.tw += 0.025;
        if (particle.y < -12) {
          particle.y = height + 12;
          particle.x = Math.random() * width;
        }
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.r, 0, Math.PI * 2);
        ctx.fillStyle = particle.c;
        ctx.globalAlpha = particle.a * (0.55 + 0.45 * Math.sin(particle.tw));
        ctx.shadowBlur = 5;
        ctx.shadowColor = particle.c;
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    };

    init();
    if (!reduce) draw();

    const resizeObserver = new ResizeObserver(init);
    const visibilityObserver = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
      },
      { threshold: 0.02 }
    );
    resizeObserver.observe(canvas);
    visibilityObserver.observe(canvas);

    return () => {
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      visibilityObserver.disconnect();
    };
  }, [density]);

  return <canvas ref={ref} className={className} aria-hidden="true" />;
};

export default Particles;
