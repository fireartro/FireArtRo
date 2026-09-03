import { useRef } from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";
import { useIsMobile } from "@/hooks/useMediaQuery";

// Dramatic easeOutExpo-style curve for a cinematic, expensive feel.
const EASE = [0.16, 1, 0.3, 1];

/**
 * One-shot transform reveal. Avoid CSS filters because large animated filter
 * layers render inconsistently on Safari and some macOS GPU configurations.
 */
export const Reveal = ({ children, delay = 0, y = 30, className, blur = true, amount = 0.18 }) => {
  const reduce = useReducedMotion();
  const mobile = useIsMobile();
  const ref = useRef(null);
  const inView = useInView(ref, { amount, margin: "-6% 0px -6% 0px", once: true });

  if (reduce) return <div ref={ref} className={className}>{children}</div>;

  const dy = mobile ? Math.min(y, 16) : y;
  const sFrom = mobile ? 1 : 0.985;

  return (
    <motion.div
      ref={ref}
      className={className}
      initial={{ opacity: 0, y: dy, scale: sFrom }}
      animate={inView ? { opacity: 1, y: 0, scale: 1 } : undefined}
      transition={{
        duration: mobile ? 0.55 : 0.85,
        delay: mobile ? 0 : delay,
        ease: EASE,
      }}
    >
      {children}
    </motion.div>
  );
};

export default Reveal;
