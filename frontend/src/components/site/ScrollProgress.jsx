import { motion, useScroll, useSpring, useReducedMotion } from "framer-motion";

export default function ScrollProgress() {
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 120, damping: 30, mass: 0.3 });
  if (reduce) return null;
  return (
    <motion.div
      style={{ scaleX }}
      className="site-scroll-progress fixed top-0 left-0 right-0 h-[3px] origin-left z-[60]"
      aria-hidden="true"
      data-testid="scroll-progress"
    />
  );
}
