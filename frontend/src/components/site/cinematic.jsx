import { useRef } from "react";
import { motion, useScroll, useTransform, useInView, useReducedMotion } from "framer-motion";
import { useIsMobile, useIsTouchDevice } from "@/hooks/useMediaQuery";

export const EASE = [0.16, 1, 0.3, 1];

const useReveal = (amount = 0.2) => {
  const ref = useRef(null);
  const inView = useInView(ref, { amount, margin: "-6% 0px -6% 0px" });
  return [ref, inView];
};

/* ---------------- Reversible scale-up (camera focusing in) ---------------- */
export const ScaleIn = ({ children, delay = 0, from = 0.94, className }) => {
  const reduce = useReducedMotion();
  const mobile = useIsMobile();
  const touch = useIsTouchDevice();
  const [ref, inView] = useReveal(0.2);
  if (reduce) return <div ref={ref} className={className}>{children}</div>;
  const scaleFrom = mobile ? 0.98 : from;
  const yFrom = mobile ? 12 : 0;
  return (
    <motion.div
      ref={ref}
      className={className}
      initial={{ opacity: 0, scale: scaleFrom, y: yFrom }}
      animate={inView ? { opacity: 1, scale: 1, y: 0 } : { opacity: 0, scale: scaleFrom, y: yFrom }}
      transition={{ duration: mobile ? 0.5 : 0.8, delay: inView ? (mobile ? 0 : delay) : 0, ease: EASE }}
    >
      {children}
    </motion.div>
  );
};

/* ---------------- Reversible slide-in (camera pan) ---------------- */
export const SlideIn = ({ children, delay = 0, x = -36, className }) => {
  const reduce = useReducedMotion();
  const mobile = useIsMobile();
  const [ref, inView] = useReveal(0.2);
  if (reduce) return <div ref={ref} className={className}>{children}</div>;
  const xFrom = mobile ? 0 : x;
  const yFrom = mobile ? 12 : 0;
  return (
    <motion.div
      ref={ref}
      className={className}
      initial={{ opacity: 0, x: xFrom, y: yFrom }}
      animate={
        inView
          ? { opacity: 1, x: 0, y: 0 }
          : { opacity: 0, x: xFrom, y: yFrom }
      }
      transition={{ duration: mobile ? 0.5 : 0.85, delay: inView ? (mobile ? 0 : delay) : 0, ease: EASE }}
    >
      {children}
    </motion.div>
  );
};

/* ---------------- Reversible staggered container + item ---------------- */
export const Stagger = ({ children, className, amount = 0.18, gap = 0.08 }) => {
  const [ref, inView] = useReveal(amount);
  return (
    <motion.div
      ref={ref}
      className={className}
      initial="hidden"
      animate={inView ? "show" : "hidden"}
      variants={{ hidden: {}, show: { transition: { staggerChildren: gap } } }}
    >
      {children}
    </motion.div>
  );
};

export const fadeUpVariant = {
  hidden: { opacity: 0, y: 26, scale: 0.985 },
  show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.7, ease: EASE } },
};

export const StaggerItem = ({ children, className }) => {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div className={className} variants={fadeUpVariant}>
      {children}
    </motion.div>
  );
};

/* ---------------- Reversible word-by-word headline reveal ---------------- */
export const RevealText = ({ text, className, as: Tag = "span", delay = 0 }) => {
  const reduce = useReducedMotion();
  const ref = useRef(null);
  const inView = useInView(ref, { amount: 0.4, margin: "-8% 0px -8% 0px" });
  const words = String(text).split(" ");
  if (reduce) return <Tag ref={ref} className={className}>{text}</Tag>;
  return (
    <Tag ref={ref} className={className} style={{ display: "inline" }}>
      {words.map((w, i) => (
        <span key={i} style={{ display: "inline-block", overflow: "hidden", verticalAlign: "top" }}>
          <motion.span
            style={{ display: "inline-block" }}
            initial={{ y: "110%" }}
            animate={inView ? { y: 0 } : { y: "110%" }}
            transition={{ duration: 0.75, delay: inView ? delay + i * 0.05 : 0, ease: EASE }}
          >
            {w}
          </motion.span>
          {i < words.length - 1 ? "\u00A0" : ""}
        </span>
      ))}
    </Tag>
  );
};

/* ---------------- Ambient floating wrapper (CSS, reduced-motion safe) ---------------- */
export const Floating = ({ children, delay = 0, className }) => (
  <div className={`animate-float-eff ${className || ""}`} style={{ animationDelay: `${delay}s` }}>
    {children}
  </div>
);

/* ---------------- 3D tilt card with cursor glare (desktop only) ---------------- */
export const TiltCard = ({ children, className, max = 9, glare = false }) => {
  const reduce = useReducedMotion();
  const mobile = useIsMobile();
  const ref = useRef(null);

  if (reduce || mobile) return <div className={`h-full ${className || ""}`}>{children}</div>;

  const onMove = (e) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    el.style.setProperty("--rx", `${(0.5 - py) * max}deg`);
    el.style.setProperty("--ry", `${(px - 0.5) * max}deg`);
    el.style.setProperty("--mx", `${px * 100}%`);
    el.style.setProperty("--my", `${py * 100}%`);
  };
  const onLeave = () => {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty("--rx", "0deg");
    el.style.setProperty("--ry", "0deg");
  };

  return (
    <div className={`tilt-card h-full ${className || ""}`}>
      <div ref={ref} className="tilt-inner" onMouseMove={onMove} onMouseLeave={onLeave}>
        {children}
        {glare && <span className="tilt-glare" />}
      </div>
    </div>
  );
};

/* ---------------- Magnetic button (follows cursor, desktop only) ---------------- */
export const MagneticButton = ({ children, className, strength = 0.28, ...rest }) => {
  const reduce = useReducedMotion();
  const mobile = useIsMobile();
  const touch = useIsTouchDevice();
  const ref = useRef(null);

  if (reduce || mobile || touch)
    return (
      <button className={className} {...rest}>
        {children}
      </button>
    );

  const onMove = (e) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = e.clientX - r.left - r.width / 2;
    const y = e.clientY - r.top - r.height / 2;
    el.style.transform = `translate(${x * strength}px, ${y * strength * 1.15}px)`;
  };
  const onLeave = () => {
    if (ref.current) ref.current.style.transform = "translate(0px, 0px)";
  };

  return (
    <button ref={ref} className={`magnetic ${className || ""}`} onMouseMove={onMove} onMouseLeave={onLeave} {...rest}>
      {children}
    </button>
  );
};

/* ---------------- Scroll parallax (disabled on mobile / reduced-motion) ---------------- */
export const Parallax = ({ children, range = 60, className }) => {
  const ref = useRef(null);
  const reduce = useReducedMotion();
  const mobile = useIsMobile();
  const touch = useIsTouchDevice();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [-range / 2, range / 2]);
  if (reduce || mobile || touch) return <div className={className}>{children}</div>;
  return (
    <motion.div ref={ref} style={{ y }} className={className}>
      {children}
    </motion.div>
  );
};

/* ---------------- Reversible cinematic section header ---------------- */
const headerVariants = (dy) => ({
  initial: { opacity: 0, y: dy },
  in: { opacity: 1, y: 0 },
});

const HeaderLine = ({ inView, reduce, mobile, delay = 0, dy = 22, className, children }) => {
  if (reduce) return <div className={className}>{children}</div>;
  const v = headerVariants(mobile ? Math.min(dy, 14) : dy);
  return (
    <motion.div
      className={className}
      initial={v.initial}
      animate={inView ? v.in : undefined}
      transition={{ duration: mobile ? 0.5 : 0.7, delay: mobile ? 0 : delay, ease: EASE }}
    >
      {children}
    </motion.div>
  );
};

export const SectionHeader = ({ kicker, title, subtitle, center, className, light }) => {
  const reduce = useReducedMotion();
  const mobile = useIsMobile();
  const ref = useRef(null);
  const inView = useInView(ref, { amount: 0.3, margin: "-6% 0px -6% 0px" });

  return (
    <div ref={ref} className={`${center ? "text-center mx-auto" : ""} max-w-2xl ${className || ""}`}>
      {kicker && (
        <HeaderLine inView={inView} reduce={reduce} mobile={mobile} dy={16}>
          <span className={`inline-flex items-center gap-2 cine-kicker text-[10px] sm:text-[11px] font-semibold ${light ? "text-white/70" : "text-[#5CB7FF]"}`}>
            <span className="h-1.5 w-1.5 rounded-full bg-gradient-to-r from-[#3A86FF] to-[#176BFF]" />
            {kicker}
          </span>
        </HeaderLine>
      )}
      <HeaderLine inView={inView} reduce={reduce} mobile={mobile} delay={0.06}>
        <h2 className="font-display font-bold text-white display-md mt-4">{title}</h2>
      </HeaderLine>
      {subtitle && (
        <HeaderLine inView={inView} reduce={reduce} mobile={mobile} delay={0.12}>
          <p className="mt-4 text-white/60 lead font-light">{subtitle}</p>
        </HeaderLine>
      )}
    </div>
  );
};
