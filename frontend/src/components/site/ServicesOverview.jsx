import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import { SERVICES } from "@/data/content";
import { useLocation, useNavigate } from "react-router-dom";
import { navigateToHref } from "@/lib/scrollNavigation";

const EASE = [0.16, 1, 0.3, 1];

export default function ServicesOverview() {
  const reduce = useReducedMotion();
  const [activeIndex, setActiveIndex] = useState(0);
  const location = useLocation();
  const navigate = useNavigate();
  const activeService = SERVICES[activeIndex];
  const ActiveIcon = activeService.icon;

  const goTo = (event, href) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    navigateToHref({ href, navigate, pathname: location.pathname });
  };

  return (
    <section id="directii" className="home-services" aria-labelledby="home-services-title">
      <header className="home-section-heading">
        <div>
          <span>Ce construim</span>
          <h2 id="home-services-title">Alegem efectul după moment, nu invers.</h2>
        </div>
        <div>
          <p>
            Drone, artificii și efecte de scenă reunite într-o producție gândită pentru loc, public și ritmul evenimentului.
          </p>
          <a href="/pachete" onClick={(event) => goTo(event, "/pachete")}>
            Vezi opțiunile <ArrowUpRight aria-hidden="true" />
          </a>
        </div>
      </header>

      <div className="home-services-showcase">
        <motion.figure
          className="home-services-visual"
          initial={reduce ? false : { opacity: 0, y: 20 }}
          whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.25 }}
          transition={{ duration: 0.72, ease: EASE }}
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.img
              key={activeService.title}
              src={activeService.image}
              alt=""
              aria-hidden="true"
              width="1100"
              height="820"
              loading="lazy"
              decoding="async"
              initial={reduce ? false : { opacity: 0, scale: 1.015 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={reduce ? undefined : { opacity: 0 }}
              transition={{ duration: reduce ? 0 : 0.42, ease: EASE }}
            />
          </AnimatePresence>
          <span className="home-services-visual-shade" aria-hidden="true" />
          <figcaption>
            <span><ActiveIcon aria-hidden="true" /></span>
            <div>
              <small>Format selectat</small>
              <strong>{activeService.title}</strong>
            </div>
          </figcaption>
        </motion.figure>

        <div className="home-services-index" aria-label="Formate de spectacol">
          {SERVICES.map((service, index) => {
            const Icon = service.icon;
            const isActive = index === activeIndex;
            return (
              <motion.button
                key={service.title}
                type="button"
                className={isActive ? "is-active" : ""}
                aria-pressed={isActive}
                onPointerEnter={() => setActiveIndex(index)}
                onFocus={() => setActiveIndex(index)}
                onClick={() => setActiveIndex(index)}
                initial={reduce ? false : { opacity: 0, y: 12 }}
                whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ duration: 0.48, delay: index * 0.05, ease: EASE }}
              >
                <span>0{index + 1}</span>
                <div>
                  <h3>{service.title}</h3>
                  <p>{service.desc}</p>
                  <small>{service.ideal}</small>
                </div>
                <Icon aria-hidden="true" />
              </motion.button>
            );
          })}
          <a className="home-services-contact" href="/contact" onClick={(event) => goTo(event, "/contact")}>
            Cere o recomandare <ArrowUpRight aria-hidden="true" />
          </a>
        </div>
      </div>
    </section>
  );
}
