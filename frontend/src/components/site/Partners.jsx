import { CMS_DEFAULTS } from "@/data/cmsDefaults";
import { motion, useReducedMotion } from "framer-motion";
import { Building2, CalendarDays, MapPinned, UsersRound } from "lucide-react";

import useManagedContent from "@/hooks/useManagedContent";

const EASE = [0.16, 1, 0.3, 1];
const COLLABORATIONS = [
  { title: "Organizatori", text: "Proiecte private și publice", icon: CalendarDays },
  { title: "Agenții", text: "Campanii și lansări de brand", icon: UsersRound },
  { title: "Locații", text: "Spații indoor și outdoor", icon: MapPinned },
  { title: "Producții", text: "Scene, festivaluri și city events", icon: Building2 },
];

export default function Partners() {
  const reduce = useReducedMotion();
  const partners = useManagedContent("partners", CMS_DEFAULTS.partners);

  return (
    <section className="home-collaboration" aria-labelledby="partners-title">
      <div className="home-collaboration-copy">
        <span>Colaborare</span>
        <h2 id="partners-title">Intrăm firesc în echipa care construiește evenimentul.</h2>
        <p>Lucrăm coordonat cu organizatorii, locațiile și furnizorii tehnici, de la primul plan până la execuția live.</p>
      </div>

      <div className="home-collaboration-grid">
        {COLLABORATIONS.map((item, index) => (
          <motion.article
            key={item.title}
            initial={reduce ? false : { opacity: 0, y: 18 }}
            whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: 0.5, delay: index * 0.05, ease: EASE }}
          >
            <item.icon aria-hidden="true" />
            <strong>{item.title}</strong>
            <span>{item.text}</span>
          </motion.article>
        ))}
      </div>

      {partners.length > 0 && (
        <div className="home-partner-rail" aria-label="Parteneri și colaboratori">
          <span>Parteneri și colaboratori</span>
          <div>
            {partners.map((partner, index) => (
              <motion.article
                key={partner.id || partner.name}
                initial={reduce ? false : { opacity: 0, y: 12 }}
                whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.5 }}
                transition={{ duration: 0.4, delay: index * 0.04, ease: EASE }}
              >
                {partner.logo ? (
                  <img src={partner.logo} alt={partner.name} loading="lazy" decoding="async" />
                ) : (
                  <strong>{partner.logoPlaceholder || partner.name}</strong>
                )}
                <span>{partner.name}</span>
              </motion.article>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
