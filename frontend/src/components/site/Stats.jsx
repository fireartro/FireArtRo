import Reveal from "@/components/site/Reveal";
import { STATS_ITEMS } from "@/data/businessContent";

export const Stats = () => (
  <section className="stats-proof home-proof" data-testid="stats-section" aria-labelledby="stats-proof-title">
    <div className="stats-proof-inner">
      <div className="home-proof-intro">
        <span>FireArtRo, pe scurt</span>
        <h2 id="stats-proof-title">O echipă pentru momente mici, scene mari și tot ce există între ele.</h2>
      </div>
      <div className="stats-proof-grid">
        {STATS_ITEMS.map((item, index) => (
          <Reveal key={item.id} delay={index * 0.05}>
            <article>
              <strong>{item.value}</strong>
              <span>{item.label}</span>
            </article>
          </Reveal>
        ))}
      </div>
    </div>
  </section>
);

export default Stats;
