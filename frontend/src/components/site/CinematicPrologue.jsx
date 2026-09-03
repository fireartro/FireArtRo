import { useCallback, useRef, useState } from "react";
import { AnimatePresence, motion, useMotionValueEvent, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { HERO_POSTER, MEDIA } from "@/data/content";
import { useIsTouchDevice } from "@/hooks/useMediaQuery";
import { scrollToHash } from "@/lib/scrollNavigation";

const EASE = [0.22, 1, 0.36, 1];
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const SCENES = [
  {
    kicker: "Prolog",
    title: "Înainte de lumină, există o așteptare.",
    text: "Oamenii se opresc. Muzica lasă loc cerului.",
    image: MEDIA.crowd2,
    glow: "#3A86FF",
    motion: "rise",
  },
  {
    kicker: "Semnătura FireArtRo",
    title: "Ideea devine ritm, formă și intensitate.",
    text: "Construim un fir vizual potrivit locului și momentului.",
    image: MEDIA.droneShow2,
    glow: "#176BFF",
    motion: "orbit",
  },
  {
    kicker: "Compoziția",
    title: "Fiecare lumină are un motiv.",
    text: "Formele, muzica și efectele sunt desenate ca o singură scenă.",
    image: MEDIA.hybrid,
    glow: "#5CB7FF",
    motion: "split",
  },
  {
    kicker: "Tensiunea",
    title: "Energia crește înainte ca cerul să răspundă.",
    text: "Ritmul pregătește publicul pentru punctul de maxim.",
    image: MEDIA.coldSparks3,
    glow: "#8F6BFF",
    motion: "pulse",
  },
  {
    kicker: "Începe povestea",
    title: "Apoi cerul preia scena.",
    text: "Urmează cele șase momente ale unui spectacol.",
    image: HERO_POSTER,
    glow: "#8F6BFF",
    motion: "burst",
    action: true,
  },
];

export const CinematicPrologue = () => {
  const ref = useRef(null);
  const reduce = useReducedMotion();
  const touch = useIsTouchDevice();
  const constrainedMotion = touch;
  const [active, setActive] = useState(0);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });

  useMotionValueEvent(scrollYProgress, "change", (value) => {
    setActive(clamp(Math.floor(value * SCENES.length), 0, SCENES.length - 1));
  });

  const frameScale = useTransform(scrollYProgress, [0, 0.08, 0.92, 1], [0.94, 1, 1, 0.95]);
  const frameClip = useTransform(
    scrollYProgress,
    [0, 0.08, 0.92, 1],
    [
      "inset(5% 3% 5% 3% round 38px)",
      "inset(0% 0% 0% 0% round 0px)",
      "inset(0% 0% 0% 0% round 0px)",
      "inset(4% 3% 4% 3% round 34px)",
    ]
  );
  const imageY = useTransform(scrollYProgress, [0, 1], ["2%", "-2%"]);
  const scene = SCENES[active];

  const goTo = useCallback((index) => {
    const section = ref.current;
    if (!section) return;
    const top = section.getBoundingClientRect().top + window.scrollY;
    const available = section.offsetHeight - window.innerHeight;
    window.scrollTo({ top: top + ((index + 0.5) / SCENES.length) * available, behavior: "smooth" });
  }, []);

  return (
    <section
      ref={ref}
      id="intro"
      className="relative bg-[#050308]"
      style={{ height: `${SCENES.length * 100}svh` }}
      data-testid="cinematic-prologue"
    >
      <motion.div
        className="apple-viewport-height sticky top-0 h-[100svh] overflow-hidden bg-[#050308]"
        style={reduce ? undefined : constrainedMotion ? { scale: frameScale } : { scale: frameScale, clipPath: frameClip }}
      >
        <AnimatePresence initial={false}>
          <motion.div
            key={scene.image}
            className="absolute inset-0"
            data-prologue-motion={scene.motion}
            initial={
              reduce
                ? false
                : constrainedMotion
                  ? { opacity: 0, scale: 1.025, y: 18 }
                : scene.motion === "split"
                  ? { opacity: 0, scale: 1.08, clipPath: "inset(0 48% 0 48% round 26px)" }
                  : scene.motion === "burst"
                    ? { opacity: 0, scale: 0.88, clipPath: "circle(20% at 50% 50%)" }
                    : { opacity: 0, scale: 1.08, y: scene.motion === "rise" ? 32 : 0 }
            }
            animate={{
              opacity: 1,
              scale: scene.motion === "pulse" ? 1.045 : 1.02,
              y: 0,
              clipPath: constrainedMotion
                ? undefined
                : scene.motion === "burst"
                  ? "circle(100% at 50% 50%)"
                  : "inset(0% 0% 0% 0% round 0px)",
            }}
            exit={reduce ? undefined : { opacity: 0, scale: 0.985, y: -18 }}
            transition={{ duration: reduce ? 0 : 0.85, ease: EASE }}
            style={reduce || constrainedMotion ? undefined : { y: imageY }}
          >
            <img src={scene.image} alt="" aria-hidden="true" width="1280" height="853" loading="lazy" decoding="async" className="h-full w-full object-cover" />
          </motion.div>
        </AnimatePresence>

        <div className="absolute inset-0 bg-black/38" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#050308]/96 via-[#050308]/68 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#050308] via-transparent to-[#050308]/52" />
        <motion.div
          className="prologue-glow absolute -right-[20vw] top-1/2 h-[62vw] w-[62vw] -translate-y-1/2 rounded-full"
          animate={{ backgroundColor: `${scene.glow}24` }}
          transition={{ duration: 0.8, ease: EASE }}
        />
        <div className={`prologue-atmosphere prologue-atmosphere-${scene.motion}`} aria-hidden="true" />

        <div className="relative z-10 mx-auto flex h-full max-w-7xl items-end px-5 pb-24 sm:px-6 md:items-center md:px-12 md:pb-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={scene.title}
              initial={reduce ? false : { opacity: 0, y: 34 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? undefined : { opacity: 0, y: -26 }}
              transition={{ duration: reduce ? 0 : 0.6, ease: EASE }}
              className="max-w-2xl"
            >
              <span className="cine-kicker text-[10px] font-semibold text-[#5CB7FF]">{scene.kicker}</span>
              <h2 className="mt-5 font-display text-[clamp(1.8rem,4vw,3.8rem)] font-bold leading-[1.04] tracking-[-0.038em] text-white">
                {scene.title}
              </h2>
              <p className="mt-5 max-w-lg text-sm font-light leading-relaxed text-white/64 sm:text-base">{scene.text}</p>
              {scene.action && (
                <button
                  type="button"
                  onClick={() => scrollToHash("#povestea")}
                  className="mt-7 inline-flex items-center gap-2 rounded-full border border-white/14 bg-black/24 px-5 py-3 text-sm font-semibold text-white backdrop-blur-md"
                >
                  Continuă povestea
                  <ArrowRight className="h-4 w-4 text-[#5CB7FF]" />
                </button>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="absolute bottom-7 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2">
          {SCENES.map((item, index) => (
            <button
              key={item.title}
              type="button"
              onClick={() => goTo(index)}
              aria-label={`Scena ${index + 1}`}
              className="flex h-8 min-w-8 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
            >
              <span className={`block h-1.5 rounded-full transition-all duration-500 ${index === active ? "w-12 bg-gradient-to-r from-[#3A86FF] to-[#176BFF]" : "w-2 bg-white/22"}`} />
            </button>
          ))}
        </div>
      </motion.div>
    </section>
  );
};

export default CinematicPrologue;
