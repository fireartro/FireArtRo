import { ArrowDown, ArrowRight } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { useLocation, useNavigate } from "react-router-dom";
import { navigateToHref } from "@/lib/scrollNavigation";

const EASE = [0.16, 1, 0.3, 1];

export default function InteriorHero({
  eyebrow,
  title,
  accent,
  description,
  primaryHref,
  primaryLabel,
  secondaryHref,
  secondaryLabel,
}) {
  const reduce = useReducedMotion();
  const location = useLocation();
  const navigate = useNavigate();
  const handleNavigate = (event, href) => {
    event.preventDefault();
    navigateToHref({ href, navigate, pathname: location.pathname });
  };
  const item = reduce
    ? {}
    : {
        initial: { opacity: 0, y: 22 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.75, ease: EASE },
      };

  return (
    <section className="interior-hero" aria-labelledby="interior-page-title">
      <div className="interior-hero-backdrop" aria-hidden="true" />
      <div className="interior-hero-inner">
        <motion.div className="interior-hero-copy" {...item}>
          <span className="interior-hero-eyebrow">{eyebrow}</span>
          <h1 id="interior-page-title">
            {title}
            {accent && <span> {accent}</span>}
          </h1>
          <p>{description}</p>
          {(primaryHref || secondaryHref) && (
            <div className="interior-hero-actions">
              {primaryHref && (
                <a className="btn-grad" href={primaryHref} onClick={(event) => handleNavigate(event, primaryHref)}>
                  {primaryLabel} <ArrowRight />
                </a>
              )}
              {secondaryHref && (
                <a href={secondaryHref} onClick={(event) => handleNavigate(event, secondaryHref)}>
                  {secondaryLabel} <ArrowDown />
                </a>
              )}
            </div>
          )}
          <span className="interior-hero-rule" aria-hidden="true" />
        </motion.div>
      </div>
    </section>
  );
}
