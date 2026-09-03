import { useRef, useState, useCallback } from "react";
import {
  motion,
  AnimatePresence,
  useScroll,
  useMotionValueEvent,
  useTransform,
  useReducedMotion,
} from "framer-motion";
import { STORY } from "@/data/content";

const EASE = [0.22, 1, 0.36, 1];
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const SCENE_VISUALS = [
  { clipPath: "circle(72% at 50% 50%)", rotate: -1.2, scale: 1.02 },
  { clipPath: "polygon(8% 0%, 100% 0%, 92% 100%, 0% 100%)", rotate: 1.1, scale: 1.035 },
  { clipPath: "inset(3% 7% 3% 7% round 28px)", rotate: 0, scale: 1.045 },
  { clipPath: "polygon(0% 7%, 93% 0%, 100% 93%, 7% 100%)", rotate: -0.8, scale: 1.055 },
  { clipPath: "circle(100% at 56% 44%)", rotate: 0, scale: 1.085 },
  { clipPath: "inset(0% 0% 0% 0% round 34px)", rotate: 0.6, scale: 1.02 },
];

/* ---------------- Drone-dot constellation (desktop, cheap) ---------------- */
const DOTS = [
  [12, 22], [20, 38], [9, 64], [28, 16], [33, 52], [24, 78],
  [70, 20], [80, 40], [66, 66], [88, 28], [76, 80], [92, 58], [58, 34], [84, 14],
];
const LINES = [[0, 1], [1, 2], [0, 3], [1, 4], [4, 5], [6, 7], [7, 8], [6, 9], [9, 13], [7, 11], [8, 10], [6, 12]];
const Constellation = () => (
  <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-[0.5]" aria-hidden="true">
    {LINES.map(([a, b], i) => (
      <line
        key={i}
        x1={`${DOTS[a][0]}%`} y1={`${DOTS[a][1]}%`}
        x2={`${DOTS[b][0]}%`} y2={`${DOTS[b][1]}%`}
        stroke="rgba(23, 107, 255,0.18)" strokeWidth="1"
      />
    ))}
    {DOTS.map(([x, y], i) => (
      <circle
        key={i} cx={`${x}%`} cy={`${y}%`} r={i % 4 === 0 ? 2.4 : 1.4}
        fill={i % 3 === 0 ? "#5AA9FF" : "#5CB7FF"}
        className="animate-twinkle"
        style={{ animationDelay: `${(i % 6) * 0.5}s` }}
      />
    ))}
  </svg>
);

/* ---------------- Vertical scroll-progress rail ---------------- */
const RailSeg = ({ progress, index, total, active, onClick, no }) => {
  const fill = useTransform(progress, (v) => `${clamp(v * total - index, 0, 1) * 100}%`);
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={`chapter-dot-${index}`}
      aria-label={`Scena ${index + 1}`}
      className="group flex items-center gap-2"
    >
      <span className={`font-mono text-[10px] tabular-nums transition-colors ${active ? "text-white" : "text-white/30 group-hover:text-white/60"}`}>{no}</span>
      <span className={`relative rounded-full overflow-hidden bg-white/12 transition-[height] duration-500 w-1 ${active ? "h-9" : "h-5"}`}>
        <motion.span className="absolute inset-x-0 top-0 rounded-full bg-gradient-to-b from-[#3A86FF] to-[#176BFF]" style={{ height: fill }} />
      </span>
    </button>
  );
};

/* ---------------- Desktop: pinned cinematic journey ---------------- */
const DesktopStory = () => {
  const ref = useRef(null);
  const reduce = useReducedMotion();
  const [active, setActive] = useState(0);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });

  useMotionValueEvent(scrollYProgress, "change", (v) => {
    setActive(clamp(Math.floor(v * STORY.length), 0, STORY.length - 1));
  });

  const goTo = useCallback((i) => {
    const el = ref.current;
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY;
    const total = el.offsetHeight - window.innerHeight;
    window.scrollTo({ top: top + ((i + 0.5) / STORY.length) * total, behavior: "smooth" });
  }, []);

  const onMove = (e) => {
    if (reduce) return;
    const r = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    setTilt({ x: -py * 8, y: px * 12 });
  };
  const onLeave = () => setTilt({ x: 0, y: 0 });

  const sc = STORY[active];

  return (
    <section
      ref={ref}
      id="povestea"
      className="relative bg-[#050308]"
      style={{ height: `${STORY.length * 74}svh` }}
      data-testid="chapters-section"
    >
      <div className="apple-viewport-height sticky top-0 h-[100svh] overflow-hidden flex items-center">
        {/* Scene-tinted layered background */}
        <motion.div
          className="absolute inset-0"
          animate={{
            background: `radial-gradient(60% 60% at 75% 30%, ${sc.glow}22, transparent 60%), radial-gradient(55% 55% at 20% 80%, ${sc.glow}14, transparent 55%)`,
          }}
          transition={{ duration: 1.1, ease: EASE }}
        />
        <Constellation />

        {/* Floating light trails */}
        <div className="absolute left-[8%] top-1/4 h-40 w-px bg-gradient-to-b from-transparent via-[#5AA9FF]/40 to-transparent animate-trail" />
        <div className="absolute right-[14%] top-1/3 h-56 w-px bg-gradient-to-b from-transparent via-[#5CB7FF]/40 to-transparent animate-trail" style={{ animationDelay: "1.5s" }} />
        <div className="absolute left-1/3 bottom-1/4 h-32 w-px bg-gradient-to-b from-transparent via-[#8F6BFF]/40 to-transparent animate-trail" style={{ animationDelay: "0.8s" }} />

        {/* Progress rail */}
        <div className="absolute right-5 lg:right-8 top-1/2 -translate-y-1/2 z-20 hidden md:flex flex-col gap-2.5">
          {STORY.map((s, i) => (
            <RailSeg key={s.no} progress={scrollYProgress} index={i} total={STORY.length} active={i === active} no={s.no} onClick={() => goTo(i)} />
          ))}
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-5 sm:px-6 md:px-12 w-full grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-7 lg:gap-16 items-center pt-16 pb-14 md:py-0">
          {/* Left — text */}
          <div className="relative order-2 md:order-1">
            <span className="cine-kicker text-[11px] sm:text-xs font-semibold text-[#5CB7FF]">Călătoria FireArtRo</span>
            <AnimatePresence mode="wait">
              <motion.div
                key={sc.no}
                initial={{ opacity: 0, y: 34 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -28 }}
                transition={{ duration: 0.55, ease: EASE }}
              >
                <div className="font-display font-bold text-white/12 leading-none text-[2.6rem] sm:text-[3.6rem] xl:text-[4.8rem] mt-2">{sc.no}</div>
                <div className="cine-kicker text-[#5CB7FF] label-xs mt-3">{sc.kicker}</div>
                <h3 className="font-display font-semibold text-white display-md mt-3 max-w-md">{sc.title}</h3>
                <p className="mt-3.5 text-white/60 lead font-light max-w-sm">{sc.text}</p>
              </motion.div>
            </AnimatePresence>
            <div className="mt-8 font-mono text-sm text-white/40 tabular-nums">
              <span className="text-white">{sc.no}</span> / 0{STORY.length}
            </div>
          </div>

          {/* Right — 3D media card */}
          <div className="relative order-1 md:order-2 perspective" onMouseMove={onMove} onMouseLeave={onLeave}>
            <motion.div
              className="relative h-[255px] sm:h-[330px] md:h-[380px] lg:h-[500px] preserve-3d"
              animate={{ rotateX: tilt.x, rotateY: tilt.y }}
              transition={{ type: "spring", stiffness: 120, damping: 18 }}
            >
              <div className="chapter-media-glow absolute -inset-6 rounded-[2rem] opacity-60" style={{ background: `radial-gradient(circle, ${sc.glow}55, transparent 70%)` }} />
              {STORY.map((s, i) => (
                <motion.div
                  key={s.no}
                  className="absolute inset-0 rounded-[1.6rem] overflow-hidden glass backface-hidden"
                  data-testid={`chapter-media-${i}`}
                  style={{ transform: "translateZ(40px)", zIndex: i === active ? 2 : 1 }}
                  animate={{
                    opacity: i === active ? 1 : 0,
                    scale: i === active ? 1 : SCENE_VISUALS[i]?.scale || 1.05,
                    rotate: i === active ? 0 : SCENE_VISUALS[i]?.rotate || 0,
                    clipPath: i === active ? SCENE_VISUALS[i]?.clipPath : "inset(12% 10% 12% 10% round 38px)",
                  }}
                  transition={{ duration: 0.82, ease: EASE }}
                >
                  <img src={s.image} alt={s.title} width="1280" height="853" loading="lazy" decoding="async" className={`w-full h-full object-cover ${i === active ? "animate-ken-burns" : ""}`} />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#050308] via-[#050308]/10 to-transparent" />
                  <div className="absolute inset-0 ring-1 ring-inset ring-white/10 rounded-[1.6rem] pointer-events-none" />
                  <div
                    className={`absolute inset-0 pointer-events-none ${
                      i === 4
                        ? "bg-[radial-gradient(circle_at_56%_42%,rgba(143, 107, 255,0.26),transparent_42%)]"
                        : i === 5
                          ? "bg-gradient-to-t from-[#050308]/70 via-transparent to-transparent"
                          : "bg-transparent"
                    }`}
                  />
                  <div className="absolute bottom-5 left-5 glass-strong rounded-full px-4 py-2" style={{ transform: "translateZ(60px)" }}>
                    <span className="text-xs font-semibold uppercase tracking-wider text-white">{s.kicker}</span>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </div>

        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 text-[9px] sm:text-[10px] uppercase tracking-[0.2em] sm:tracking-[0.25em] text-white/30 hidden sm:flex items-center gap-2">
          <span className="inline-block w-5 h-px bg-white/20" />
          Derulează pentru a trăi povestea
          <span className="inline-block w-5 h-px bg-white/20" />
        </div>
        <div className="absolute bottom-5 left-5 right-5 z-20 flex items-center gap-1.5 sm:hidden">
          {STORY.map((story, index) => (
            <span
              key={story.no}
              className={`h-1 flex-1 rounded-full transition-colors duration-500 ${
                index === active ? "bg-gradient-to-r from-[#3A86FF] to-[#176BFF]" : "bg-white/16"
              }`}
            />
          ))}
        </div>
      </div>
    </section>
  );
};

export const Chapters = () => <DesktopStory />;

export default Chapters;
