import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { PROCESS_ENHANCED } from "@/data/content";
import { goToContact } from "@/lib/contactNavigation";

const EASE = [0.16, 1, 0.3, 1];

export const Process = () => {
  const reduce = useReducedMotion();

  return (
    <section
      id="proces"
      className="process-editorial"
      data-testid="process-section"
      aria-labelledby="process-title"
    >
      <header className="process-editorial-header">
        <div>
          <span>Cum lucrăm</span>
          <h2 id="process-title">Cinci pași, fără improvizații în seara evenimentului.</h2>
        </div>
        <div>
          <p>Fiecare etapă se încheie cu o decizie clară. Tu știi mereu unde este proiectul și ce urmează.</p>
          <button type="button" onClick={() => goToContact()}>
            Începe brief-ul <ArrowRight aria-hidden="true" />
          </button>
        </div>
      </header>

      <div className="process-editorial-list">
        {PROCESS_ENHANCED.map((item, index) => {
          const Icon = item.icon;
          return (
            <motion.article
              key={item.step}
              data-testid={`process-step-${index}`}
              initial={reduce ? false : { opacity: 0, y: 24 }}
              whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.25 }}
              transition={{ duration: 0.55, delay: index * 0.035, ease: EASE }}
            >
              <span className="process-editorial-number">{item.step}</span>
              <span className="process-editorial-icon"><Icon aria-hidden="true" /></span>
              <div>
                <h3>{item.title}</h3>
                <p>{item.desc}</p>
              </div>
              <strong>{item.result}</strong>
            </motion.article>
          );
        })}
      </div>
    </section>
  );
};

export default Process;
