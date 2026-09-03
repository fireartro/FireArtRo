import Navbar from "@/components/site/Navbar";
import ScrollProgress from "@/components/site/ScrollProgress";
import Faq from "@/components/site/Faq";
import PageEnd from "@/components/site/PageEnd";
import usePageMeta from "@/hooks/usePageMeta";
import "@/styles/night-faq.css";
import { CMS_DEFAULTS } from "@/data/cmsDefaults";
import useManagedContent from "@/hooks/useManagedContent";
import ManagedPageMedia from "@/components/site/ManagedPageMedia";

export default function FaqPage() {
  const copy = useManagedContent("faqPage", CMS_DEFAULTS.faqPage);
  usePageMeta({
    title: copy.seoTitle,
    description: copy.seoDescription,
    path: "/intrebari-frecvente",
  });

  return (
    <div className="nr-faq-route">
      <ScrollProgress />
      <Navbar />

      <main className="nr-faq-page" data-design="night-runway">
        <header className="nr-faq-hero">
          <div className="nr-shell nr-faq-hero__inner">
            <div>
              <p className="nr-faq-hero__eyebrow">{copy.eyebrow}</p>
              <h1>{copy.title}</h1>
            </div>
            <p className="nr-faq-hero__description">
              {copy.description}
            </p>
          </div>
        </header>
        <ManagedPageMedia mediaId={copy.heroMediaId} />

        <Faq />
      </main>

      <PageEnd />
    </div>
  );
}
