import { useLayoutEffect, useRef } from "react";
import { useReducedMotion } from "framer-motion";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const BAND_COUNT = 5;

export default function SectionShutter({ outgoing, incoming }) {
  const rootRef = useRef(null);
  const stageRef = useRef(null);
  const outgoingRef = useRef(null);
  const incomingRef = useRef(null);
  const bandRefs = useRef([]);
  const reduceMotion = useReducedMotion();

  useLayoutEffect(() => {
    const root = rootRef.current;
    const stage = stageRef.current;
    const outgoingLayer = outgoingRef.current;
    const incomingLayer = incomingRef.current;
    const bands = bandRefs.current.filter(Boolean);

    if (!root || !stage || !outgoingLayer || !incomingLayer || reduceMotion || !bands.length) {
      return undefined;
    }

    const context = gsap.context(() => {
      gsap.set(incomingLayer, { autoAlpha: 0, scale: 1.018 });
      gsap.set(outgoingLayer, { autoAlpha: 1, scale: 1 });
      gsap.set(bands, { scaleY: 0, transformOrigin: "bottom center", force3D: true });

      const timeline = gsap.timeline({
        defaults: { ease: "none" },
        scrollTrigger: {
          id: "fireart-section-shutter",
          trigger: root,
          start: "top top",
          end: "bottom bottom",
          scrub: 0.48,
          invalidateOnRefresh: true,
        },
      });

      bands.forEach((band, index) => {
        const reverseIndex = bands.length - 1 - index;
        timeline.to(
          band,
          { scaleY: 1.035, duration: 0.3, transformOrigin: "bottom center" },
          0.075 * reverseIndex,
        );
      });

      timeline
        .set(outgoingLayer, { autoAlpha: 0 }, 0.61)
        .set(incomingLayer, { autoAlpha: 1 }, 0.61)
        .to(incomingLayer, { scale: 1, duration: 0.4 }, 0.61);

      bands.forEach((band, index) => {
        timeline.to(
          band,
          { scaleY: 0, duration: 0.3, transformOrigin: "top center" },
          0.7 + index * 0.075,
        );
      });
    }, root);

    return () => context.revert();
  }, [reduceMotion]);

  if (reduceMotion) {
    return (
      <section
        ref={rootRef}
        className="fa-shutter fa-shutter--static"
        data-testid="section-shutter"
        data-motion="static"
        aria-hidden="true"
      >
        <img src={incoming.src} alt="" loading="lazy" decoding="async" />
      </section>
    );
  }

  return (
    <section
      ref={rootRef}
      className="fa-shutter"
      data-testid="section-shutter"
      data-motion="scroll"
      aria-hidden="true"
    >
      <div ref={stageRef} className="fa-shutter__stage">
        <div ref={outgoingRef} className="fa-shutter__media fa-shutter__media--outgoing">
          <img src={outgoing.src} alt="" loading="lazy" decoding="async" />
        </div>
        <div ref={incomingRef} className="fa-shutter__media fa-shutter__media--incoming">
          <img src={incoming.src} alt="" loading="lazy" decoding="async" />
        </div>
        <div className="fa-shutter__veil" />
        <div className="fa-shutter__bands">
          {Array.from({ length: BAND_COUNT }, (_, index) => (
            <span
              key={index}
              ref={(node) => {
                bandRefs.current[index] = node;
              }}
              className="fa-shutter__band"
              data-shutter-band
            />
          ))}
        </div>
      </div>
    </section>
  );
}
