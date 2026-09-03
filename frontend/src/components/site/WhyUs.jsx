import { ArrowRight } from "lucide-react";
import Reveal from "@/components/site/Reveal";
import { MEDIA, TECH } from "@/data/content";
import { goToContact } from "@/lib/contactNavigation";

export const WhyUs = () => (
  <section id="de-ce-noi" className="home-trust" data-testid="why-section" aria-labelledby="home-trust-title">
    <div className="home-trust-layout">
      <Reveal>
        <figure className="home-trust-media">
          <img
            src={MEDIA.corporate}
            alt="Echipă și public la un spectacol FireArtRo"
            width="900"
            height="1100"
            loading="lazy"
            decoding="async"
          />
          <figcaption>Planificare reală, pentru condițiile reale ale evenimentului.</figcaption>
        </figure>
      </Reveal>

      <div className="home-trust-content">
        <Reveal>
          <span className="home-kicker">Control înainte de impact</span>
          <h2 id="home-trust-title">Spectacolul se vede pe cer. Munca serioasă rămâne în culise.</h2>
          <p>
            Fiecare decizie vizuală este legată de locație, logistică, sincronizare și siguranța publicului.
          </p>
        </Reveal>

        <div className="home-trust-list">
          {TECH.map((item, index) => (
            <Reveal key={item.title} delay={(index % 3) * 0.04}>
              <article>
                <span>0{index + 1}</span>
                <item.icon aria-hidden="true" />
                <div>
                  <h3>{item.title}</h3>
                  <p>{item.desc}</p>
                </div>
              </article>
            </Reveal>
          ))}
        </div>
        <button type="button" onClick={() => goToContact()} className="home-text-link">
          Discută locația evenimentului <ArrowRight aria-hidden="true" />
        </button>
      </div>
    </div>
  </section>
);

export default WhyUs;
