import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { Sparkle, Sparkles } from "lucide-react";

// Deterministic field of floating brand sparks — choreographed to scroll.
const MARKS = [
  { x: 6, y: 22, size: 30, o: 0.22, color: "#5CB7FF", dur: 6, delay: 0, type: "s" },
  { x: 14, y: 70, size: 18, o: 0.14, color: "#5AA9FF", dur: 7, delay: 1.1, type: "k" },
  { x: 22, y: 30, size: 14, o: 0.12, color: "#ffffff", dur: 5.5, delay: 0.6, type: "k" },
  { x: 30, y: 84, size: 24, o: 0.18, color: "#5CB7FF", dur: 6.5, delay: 1.6, type: "s" },
  { x: 41, y: 15, size: 16, o: 0.14, color: "#5AA9FF", dur: 6, delay: 0.9, type: "k" },
  { x: 49, y: 60, size: 20, o: 0.12, color: "#ffffff", dur: 7.5, delay: 2.0, type: "s" },
  { x: 58, y: 24, size: 28, o: 0.2, color: "#5CB7FF", dur: 6, delay: 0.4, type: "s" },
  { x: 64, y: 78, size: 16, o: 0.14, color: "#5AA9FF", dur: 5.8, delay: 1.3, type: "k" },
  { x: 71, y: 40, size: 34, o: 0.24, color: "#5CB7FF", dur: 7, delay: 0.2, type: "s" },
  { x: 77, y: 17, size: 18, o: 0.16, color: "#ffffff", dur: 6.2, delay: 1.5, type: "k" },
  { x: 83, y: 66, size: 26, o: 0.2, color: "#5AA9FF", dur: 6.8, delay: 0.7, type: "s" },
  { x: 89, y: 34, size: 20, o: 0.16, color: "#5CB7FF", dur: 5.6, delay: 1.9, type: "k" },
  { x: 93, y: 80, size: 16, o: 0.14, color: "#ffffff", dur: 7, delay: 1.0, type: "k" },
  { x: 36, y: 48, size: 14, o: 0.1, color: "#5AA9FF", dur: 6.4, delay: 2.2, type: "k" },
  { x: 54, y: 88, size: 22, o: 0.16, color: "#5CB7FF", dur: 6.6, delay: 0.5, type: "s" },
  { x: 11, y: 45, size: 16, o: 0.12, color: "#ffffff", dur: 5.9, delay: 1.7, type: "k" },
  { x: 96, y: 12, size: 24, o: 0.18, color: "#5CB7FF", dur: 6.1, delay: 0.3, type: "s" },
  { x: 2, y: 78, size: 20, o: 0.14, color: "#5AA9FF", dur: 7.2, delay: 1.4, type: "s" },
];

export const FloatingLogos = () => {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [0, -160]);
  const opacity = useTransform(scrollYProgress, [0, 0.85], [1, 0]);

  return (
    <motion.div
      ref={ref}
      style={{ y, opacity }}
      aria-hidden="true"
      className="absolute inset-0 z-[8] pointer-events-none overflow-hidden"
    >
      {MARKS.map((m, i) => {
        const Icon = m.type === "s" ? Sparkles : Sparkle;
        return (
          <motion.div
            key={i}
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.35 + i * 0.045, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="absolute"
            style={{ left: `${m.x}%`, top: `${m.y}%` }}
          >
            <div
              className="animate-float-eff"
              style={{ animationDuration: `${m.dur}s`, animationDelay: `${m.delay}s` }}
            >
              <Icon
                style={{
                  width: m.size,
                  height: m.size,
                  color: m.color,
                  opacity: m.o,
                  filter: `drop-shadow(0 0 6px ${m.color}) ${m.size < 20 ? "blur(0.4px)" : ""}`,
                }}
              />
            </div>
          </motion.div>
        );
      })}
    </motion.div>
  );
};

export default FloatingLogos;
