import { useCallback, useRef, useState } from "react";
import {
  AnimatePresence,
  motion,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
} from "framer-motion";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { PORTFOLIO } from "@/data/content";
import { useIsMobile, useIsTouchDevice } from "@/hooks/useMediaQuery";
import { goToContact } from "@/lib/contactNavigation";

const EASE = [0.22, 1, 0.36, 1];
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export const Showcase = () => {
  const ref = useRef(null);
  const reduce = useReducedMotion();
  const mobile = useIsMobile();
  const touch = useIsTouchDevice();
  const compactMotion = mobile || touch;
  const [active, setActive] = useState(0);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });

  useMotionValueEvent(scrollYProgress, "change", (value) => {
    const next = clamp(Math.floor(value * PORTFOLIO.length), 0, PORTFOLIO.length - 1);
    if (next !== active) {
      setActive(next);
    }
  });

  const goTo = useCallback((index) => {
    const section = ref.current;
    if (!section) return;
    const top = section.getBoundingClientRect().top + window.scrollY;
    const available = section.offsetHeight - window.innerHeight;
    window.scrollTo({
      top: top + ((index + 0.45) / PORTFOLIO.length) * available,
      behavior: "smooth",
    });
  }, []);

  const go = (step) => goTo((active + step + PORTFOLIO.length) % PORTFOLIO.length);
  const project = PORTFOLIO[active];

  return (
    <section
      ref={ref}
      id="spectacole"
      className="relative bg-[#050308]"
      style={{ height: `${PORTFOLIO.length * 58}svh` }}
      data-testid="showcase-section"
    >
      <div className="apple-viewport-height sticky top-0 h-[100svh] overflow-hidden bg-[#050308]">
        {PORTFOLIO.map((item, index) => (
          <motion.div
            key={item.image}
            className="absolute inset-0"
            animate={{
              opacity: index === active ? 1 : 0,
              scale: index === active ? 1 : 1.06,
              x: index === active ? 0 : (index < active ? -1 : 1) * (compactMotion ? 24 : 68),
            }}
            transition={{ duration: reduce ? 0 : compactMotion ? 0.48 : 0.78, ease: EASE }}
            style={{ pointerEvents: index === active ? "auto" : "none" }}
          >
              <img
                src={item.image}
                alt={item.title}
                width="1280"
                height="853"
                loading={index === 0 ? "eager" : "lazy"}
              decoding="async"
              className="h-full w-full object-cover"
            />
          </motion.div>
        ))}

        <div className="absolute inset-0 bg-black/34" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#050308] via-[#050308]/72 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#050308] via-transparent to-[#050308]/68" />
        <div className="absolute inset-0 shadow-[inset_0_0_190px_40px_rgba(5,3,8,0.72)]" />

        <div className="absolute left-5 top-20 z-20 md:left-12 md:top-24">
          <span className="cine-kicker text-[9px] font-semibold text-white/48 md:text-[10px]">Spectacole realizate</span>
          <h2 className="mt-2 max-w-[17rem] font-display text-lg font-semibold text-white md:max-w-none md:text-xl">
            Fiecare eveniment, o scenă diferită
          </h2>
        </div>

        <div className="relative z-10 mx-auto flex h-full w-full max-w-7xl items-end px-5 pb-28 md:px-12 md:pb-36">
          <AnimatePresence mode="wait">
            <motion.div
              key={project.title}
              initial={reduce ? false : { opacity: 0, y: compactMotion ? 24 : 58 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? undefined : { opacity: 0, y: compactMotion ? -18 : -38 }}
              transition={{ duration: reduce ? 0 : compactMotion ? 0.46 : 0.68, delay: 0.06, ease: EASE }}
              className="max-w-3xl"
            >
              <div className="flex items-center gap-3">
                <span className="cine-kicker text-[9px] font-semibold text-[#5CB7FF] md:text-[10px]">{project.category}</span>
                <span className="h-px w-10 bg-gradient-to-r from-[#5CB7FF] to-transparent md:w-12" />
                <span className="font-mono text-[10px] text-white/45">
                  {String(active + 1).padStart(2, "0")} / {String(PORTFOLIO.length).padStart(2, "0")}
                </span>
              </div>
              <h3 className="mt-4 max-w-3xl font-display text-[clamp(2rem,4.8vw,4.8rem)] font-extrabold leading-[0.98] tracking-[-0.04em] text-white text-bloom md:mt-5">
                {project.title}
              </h3>
              <p className="mt-4 max-w-xl text-sm font-light leading-relaxed text-white/72 md:mt-6 md:text-lg">{project.desc}</p>
              <button
                type="button"
                onClick={() => goToContact()}
                data-testid="showcase-cta"
                className="mt-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/28 px-5 py-3 text-sm font-semibold text-white backdrop-blur-md transition-colors hover:bg-white/10 md:mt-8 md:px-6"
              >
                Vreau un spectacol ca acesta
                <ArrowRight className="h-4 w-4 text-[#5CB7FF]" />
              </button>
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="absolute right-5 top-20 z-20 flex items-center gap-2 md:right-12 md:top-24">
          <button
            type="button"
            onClick={() => go(-1)}
            aria-label="Spectacolul anterior"
            data-testid="showcase-prev"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-white/14 bg-black/25 text-white backdrop-blur-md transition-colors hover:bg-white/10 md:h-11 md:w-11"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => go(1)}
            aria-label="Spectacolul următor"
            data-testid="showcase-next"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-white/14 bg-black/25 text-white backdrop-blur-md transition-colors hover:bg-white/10 md:h-11 md:w-11"
          >
            <ArrowRight className="h-5 w-5" />
          </button>
        </div>

        <div className="absolute bottom-6 left-5 right-5 z-20 md:bottom-7 md:left-12 md:right-12">
          <div className="flex items-end gap-2">
            {PORTFOLIO.map((item, index) => (
              <button
                type="button"
                key={item.title}
                onClick={() => goTo(index)}
                data-testid={`showcase-tab-${index}`}
                aria-label={`Mergi la ${item.category}`}
                className="group min-w-0 flex-1 text-left"
              >
                <span className={`block h-1 rounded-full transition-all duration-500 md:h-px ${
                  index === active
                    ? "bg-[#2f9fe3]"
                    : "bg-white/18 group-hover:bg-white/38"
                }`} />
                <span className={`mt-2 hidden truncate text-[10px] uppercase tracking-[0.16em] lg:block ${
                  index === active ? "text-white" : "text-white/35"
                }`}>
                  {item.category}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default Showcase;
