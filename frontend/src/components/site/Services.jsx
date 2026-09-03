import { useState } from "react";
import { AnimatePresence, motion, useMotionValue, useReducedMotion, useSpring, useTransform } from "framer-motion";
import { ArrowRight, Check } from "lucide-react";
import { SERVICES } from "@/data/content";
import { useIsTouchDevice } from "@/hooks/useMediaQuery";
import { goToContact } from "@/lib/contactNavigation";

const EASE = [0.16, 1, 0.3, 1];

const DETAILS = [
  { impact: "Silencios & precis", environment: "Outdoor", role: "Poveste, logo, mesaje" },
  { impact: "Energie maximă", environment: "Outdoor", role: "Final și punct culminant" },
  { impact: "Experiență completă", environment: "Outdoor", role: "Moment central premium" },
  { impact: "Controlat & apropiat", environment: "Indoor / Outdoor", role: "Intrări, dans, scenă" },
];

export const Services = () => {
  const [active, setActive] = useState(0);
  const service = SERVICES[active];
  const detail = DETAILS[active];
  const Icon = service.icon;
  const reduce = useReducedMotion();
  const touch = useIsTouchDevice();
  const pointerX = useMotionValue(0);
  const pointerY = useMotionValue(0);
  const smoothX = useSpring(pointerX, { stiffness: 90, damping: 20 });
  const smoothY = useSpring(pointerY, { stiffness: 90, damping: 20 });
  const rotateY = useTransform(smoothX, [-0.5, 0.5], [-3.5, 3.5]);
  const rotateX = useTransform(smoothY, [-0.5, 0.5], [2.4, -2.4]);

  const onMove = (event) => {
    if (touch || reduce) return;
    const rect = event.currentTarget.getBoundingClientRect();
    pointerX.set((event.clientX - rect.left) / rect.width - 0.5);
    pointerY.set((event.clientY - rect.top) / rect.height - 0.5);
  };

  const resetPerspective = () => {
    pointerX.set(0);
    pointerY.set(0);
  };

  return (
    <section className="service-builder" data-testid="services-section" aria-labelledby="service-builder-title">
      <header className="service-builder-header">
        <div>
          <span>Construiește experiența</span>
          <h2 id="service-builder-title">Ce vrei să simtă publicul?</h2>
        </div>
        <p>
          Alege efectul principal. Noi combinăm tehnologia, ritmul și logistica într-un singur scenariu.
        </p>
      </header>

      <div className="service-builder-tabs" role="tablist" aria-label="Tipuri de spectacole">
        {SERVICES.map((item, index) => (
          <button
            key={item.title}
            type="button"
            role="tab"
            aria-selected={active === index}
            onClick={() => setActive(index)}
            data-testid={`service-card-${index}`}
          >
            <span>{String(index + 1).padStart(2, "0")}</span>
            {item.title}
          </button>
        ))}
      </div>

      <motion.div
        className="service-builder-stage"
        onMouseMove={onMove}
        onMouseLeave={resetPerspective}
        style={reduce || touch ? undefined : { rotateX, rotateY }}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={service.image}
            className="service-builder-media"
            initial={reduce ? false : { opacity: 0, scale: 1.035 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={reduce ? undefined : { opacity: 0, scale: 0.985 }}
            transition={{ duration: 0.72, ease: EASE }}
          >
            <img src={service.image} alt={service.title} width="1280" height="853" loading="lazy" decoding="async" />
          </motion.div>
        </AnimatePresence>

        <div className="service-builder-shade" />
        <div className="service-builder-grid" aria-hidden="true" />

        <AnimatePresence mode="wait">
          <motion.div
            key={service.title}
            className="service-builder-copy"
            initial={reduce ? false : { opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? undefined : { opacity: 0, y: -16 }}
            transition={{ duration: 0.5, ease: EASE }}
          >
            <div className="service-builder-icon" aria-hidden="true">
              <Icon />
            </div>
            <span className="service-builder-label">Direcția {String(active + 1).padStart(2, "0")}</span>
            <h3>{service.title}</h3>
            <p>{service.desc}</p>
            <ul>
              {service.benefits.map((benefit) => (
                <li key={benefit}><Check /> {benefit}</li>
              ))}
            </ul>
          </motion.div>
        </AnimatePresence>

        <motion.aside
          className="service-builder-spec"
          initial={reduce ? false : { opacity: 0, x: 28 }}
          whileInView={reduce ? undefined : { opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, ease: EASE }}
        >
          <span>Configurație recomandată</span>
          <dl>
            <div><dt>Impact</dt><dd>{detail.impact}</dd></div>
            <div><dt>Mediu</dt><dd>{detail.environment}</dd></div>
            <div><dt>Rol în eveniment</dt><dd>{detail.role}</dd></div>
            <div><dt>Potrivit pentru</dt><dd>{service.ideal}</dd></div>
          </dl>
          <button type="button" onClick={() => goToContact({ services: [service.title] })}>
            Configurează direcția <ArrowRight />
          </button>
        </motion.aside>

        <div className="service-builder-depth" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      </motion.div>
    </section>
  );
};

export default Services;
