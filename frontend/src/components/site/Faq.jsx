import { ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { CMS_DEFAULTS } from "@/data/cmsDefaults";
import useManagedContent from "@/hooks/useManagedContent";

export const Faq = () => {
  const faqs = useManagedContent("faqs", CMS_DEFAULTS.faqs);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };

  return (
    <section
      id="raspunsuri"
      className="nr-faq"
      data-testid="faq-section"
      aria-labelledby="nr-faq-content-title"
    >
      <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>

      <div className="nr-shell nr-faq__layout">
        <div className="nr-faq__rail" aria-hidden="true">
          <span>{String(faqs.length).padStart(2, "0")}</span>
          <p>Răspunsuri</p>
        </div>

        <div className="nr-faq__content">
          <h2 id="nr-faq-content-title" className="nr-faq__sr-only">
            Răspunsuri la întrebările frecvente
          </h2>

          <Accordion type="single" collapsible className="nr-faq__questions">
            {faqs.map((item, index) => (
              <AccordionItem
                key={item.id}
                value={item.id}
                className="nr-faq__question"
                data-testid="faq-question"
              >
                <AccordionTrigger className="nr-faq__trigger">
                  <span className="nr-faq__index" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
                  <span className="nr-faq__question-copy">{item.q}</span>
                </AccordionTrigger>
                <AccordionContent className="nr-faq__answer">
                  <p>{item.a}</p>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>

          <section
            className="nr-faq__contact"
            data-testid="faq-contact-close"
            aria-labelledby="faq-contact-title"
          >
            <div>
              <h2 id="faq-contact-title">Nu ai găsit răspunsul?</h2>
              <p>Spune-ne data și locația.</p>
            </div>
            <Link to="/contact">
              Contactează-ne
              <ArrowUpRight aria-hidden="true" />
            </Link>
          </section>
        </div>
      </div>
    </section>
  );
};

export default Faq;
