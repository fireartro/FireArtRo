import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import Reveal from "@/components/site/Reveal";
import { PORTFOLIO } from "@/data/content";

export const Portfolio = () => {
  return (
    <section id="spectacole" className="relative py-24 md:py-32" data-testid="portfolio-section">
      <div className="max-w-7xl mx-auto px-6 md:px-12">
        <Reveal>
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
            <div className="max-w-2xl">
              <span className="text-xs sm:text-sm font-semibold uppercase tracking-[0.2em] text-[#176BFF]">
                Spectacole realizate
              </span>
              <h2 className="font-display font-bold text-white text-4xl sm:text-5xl mt-4 tracking-tight">
                Momente care rămân în amintire
              </h2>
            </div>
            <p className="text-white/55 font-light max-w-md md:text-right">
              Câteva dintre experiențele vizuale create pentru clienții noștri — fiecare,
              unică în felul ei.
            </p>
          </div>
        </Reveal>

        <Reveal delay={0.1}>
          <div className="mt-14">
            <Carousel opts={{ align: "start", loop: true }} className="w-full" data-testid="portfolio-carousel">
              <CarouselContent className="-ml-4">
                {PORTFOLIO.map((p, i) => (
                  <CarouselItem
                    key={p.title}
                    className="pl-4 basis-[85%] sm:basis-1/2 lg:basis-1/3"
                  >
                    <div
                      className="group relative h-[420px] rounded-3xl overflow-hidden glass"
                      data-testid={`portfolio-card-${i}`}
                    >
                      <img
                        src={p.image}
                        alt={p.title}
                        loading="lazy"
                        className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#050308] via-[#050308]/30 to-transparent" />
                      <div className="absolute inset-0 bg-[#176BFF]/0 group-hover:bg-[#176BFF]/10 transition-colors duration-500" />

                      <div className="absolute top-5 left-5">
                        <span className="glass text-xs font-semibold uppercase tracking-wider text-white px-3 py-1.5 rounded-full">
                          {p.category}
                        </span>
                      </div>

                      <div className="absolute bottom-0 left-0 right-0 p-7">
                        <h3 className="font-display font-semibold text-2xl text-white">{p.title}</h3>
                        <div className="mt-2 h-px w-12 bg-gradient-to-r from-[#3A86FF] to-[#176BFF] group-hover:w-24 transition-all duration-500" />
                      </div>
                    </div>
                  </CarouselItem>
                ))}
              </CarouselContent>
              <div className="flex items-center justify-end gap-3 mt-8">
                <CarouselPrevious
                  data-testid="portfolio-prev"
                  className="static translate-y-0 h-11 w-11 bg-white/5 border-white/15 text-white hover:bg-[#176BFF] hover:border-[#176BFF]"
                />
                <CarouselNext
                  data-testid="portfolio-next"
                  className="static translate-y-0 h-11 w-11 bg-white/5 border-white/15 text-white hover:bg-[#176BFF] hover:border-[#176BFF]"
                />
              </div>
            </Carousel>
          </div>
        </Reveal>
      </div>
    </section>
  );
};

export default Portfolio;
