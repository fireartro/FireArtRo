import { useRef } from "react";
import { motion, useReducedMotion, useScroll, useSpring, useTransform } from "framer-motion";
import { useIsMobile, useIsTouchDevice } from "@/hooks/useMediaQuery";

const spring = { stiffness: 92, damping: 24, mass: 0.42 };

export const CinematicScene = ({
  children,
  id,
  index,
  label,
  accent = "#176BFF",
  motionType = "focus",
  className = "",
}) => {
  const ref = useRef(null);
  const reduce = useReducedMotion();
  const mobile = useIsMobile();
  const touch = useIsTouchDevice();
  const constrainedMotion = mobile || touch;
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const progress = useSpring(scrollYProgress, spring);

  const subtleY = useTransform(progress, [0, 0.16, 0.84, 1], [mobile ? 28 : 58, 0, 0, mobile ? -18 : -38]);
  const liftY = useTransform(progress, [0, 0.18, 0.82, 1], [mobile ? 62 : 128, 0, 0, mobile ? -34 : -76]);
  const focusScale = useTransform(progress, [0, 0.17, 0.84, 1], [mobile ? 0.97 : 0.9, 1, 1, mobile ? 0.985 : 0.95]);
  const depthScale = useTransform(progress, [0, 0.18, 0.82, 1], [mobile ? 0.94 : 0.82, 1, 1, mobile ? 0.97 : 0.91]);
  const depthRotate = useTransform(progress, [0, 0.18, 0.82, 1], [mobile ? 2 : 6, 0, 0, mobile ? -1 : -4]);
  const curtainClip = useTransform(
    progress,
    [0, 0.17, 0.84, 1],
    ["inset(0% 0% 72% 0% round 30px)", "inset(0% 0% 0% 0% round 0px)", "inset(0% 0% 0% 0% round 0px)", "inset(12% 0% 0% 0% round 24px)"]
  );
  const apertureClip = useTransform(
    progress,
    [0, 0.17, 0.84, 1],
    ["circle(24% at 50% 62%)", "circle(100% at 50% 50%)", "circle(100% at 50% 50%)", "circle(72% at 50% 38%)"]
  );
  const foldClip = useTransform(
    progress,
    [0, 0.18, 0.83, 1],
    ["inset(10% 8% 10% 8% round 36px)", "inset(0% 0% 0% 0% round 0px)", "inset(0% 0% 0% 0% round 0px)", "inset(5% 4% 7% 4% round 30px)"]
  );

  const styles = {
    focus: { y: subtleY, scale: focusScale },
    curtain: { y: subtleY, clipPath: curtainClip },
    aperture: { scale: focusScale, clipPath: apertureClip },
    depth: { y: liftY, scale: depthScale, rotateX: depthRotate },
    fold: { y: subtleY, scale: focusScale, clipPath: foldClip },
    lift: { y: liftY, scale: focusScale },
  };

  const constrainedStyles = {
    focus: { y: subtleY, scale: focusScale },
    curtain: { y: subtleY },
    aperture: { scale: focusScale },
    depth: { y: liftY, scale: focusScale },
    fold: { y: subtleY, scale: focusScale },
    lift: { y: liftY },
  };

  return (
    <div
      ref={ref}
      id={id}
      className={`cinema-scene-shell ${className}`}
      style={{ "--scene-accent": accent }}
      data-cinema-scene={index}
      data-motion={motionType}
    >
      <span className="story-flow-node" aria-hidden="true" />
      <motion.div
        className="cinema-scene-frame"
        style={
          reduce
            ? undefined
            : constrainedMotion
              ? constrainedStyles[motionType] || constrainedStyles.focus
              : styles[motionType] || styles.focus
        }
      >
        <span className="cinema-scene-edge cinema-scene-edge-top" aria-hidden="true" />
        <span className="cinema-scene-edge cinema-scene-edge-bottom" aria-hidden="true" />
        <span className="cinema-scene-light" aria-hidden="true" />
        {index && (
          <div className="cinema-scene-meta" aria-hidden="true">
            <span>{String(index).padStart(2, "0")}</span>
            <span>{label}</span>
          </div>
        )}
        {children}
      </motion.div>
    </div>
  );
};

export default CinematicScene;
