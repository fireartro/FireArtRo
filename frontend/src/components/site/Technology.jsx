import { SectionHeader, Floating } from "@/components/site/cinematic";
import Reveal from "@/components/site/Reveal";
import { TECH } from "@/data/content";

export const Technology = () => {
  return (
    <section className="relative py-24 md:py-32" data-testid="technology-section">
      <div className="max-w-7xl mx-auto px-6 md:px-12">
        <div className="lg:grid lg:grid-cols-[0.85fr_1.4fr] lg:gap-16">
          {/* Sticky header (cinematic depth-parallax) */}
          <div className="lg:sticky lg:top-28 lg:self-start mb-12 lg:mb-0">
            <SectionHeader
              kicker="Tehnologie & încredere"
              title="Spectacol impecabil, fără compromisuri"
              subtitle="În spatele fiecărui moment „wow” stau planificare, tehnologie și o echipă care nu lasă nimic la voia întâmplării."
            />
          </div>

          {/* Scrolling cards */}
          <div className="grid sm:grid-cols-2 gap-5">
            {TECH.map((t, i) => (
              <Reveal key={t.title} delay={(i % 2) * 0.08}>
                <div
                  className="group relative h-full glass rounded-2xl p-7 hover:-translate-y-1.5 hover:border-white/20 transition-all duration-300"
                  data-testid={`tech-card-${i}`}
                >
                  <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#176BFF]/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <Floating delay={i * 0.4}>
                    <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-[#3A86FF]/20 to-[#176BFF]/20 border border-white/10 flex items-center justify-center group-hover:glow-ring transition-all duration-300">
                      <t.icon className="h-6 w-6 text-[#5CB7FF]" />
                    </div>
                  </Floating>
                  <h3 className="mt-5 font-display font-semibold text-lg text-white">{t.title}</h3>
                  <p className="mt-3 text-white/55 font-light leading-relaxed">{t.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default Technology;
