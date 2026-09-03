import { Link } from "react-router-dom";
import { ArrowRight, ExternalLink, Mail } from "lucide-react";
import Navbar from "@/components/site/Navbar";
import ScrollProgress from "@/components/site/ScrollProgress";
import PageEnd from "@/components/site/PageEnd";
import usePageMeta from "@/hooks/usePageMeta";
import useManagedContent from "@/hooks/useManagedContent";
import { EMAIL } from "@/lib/constants";
import { CMS_DEFAULTS } from "@/data/cmsDefaults";
import { LEGAL_PAGE_PRESENTATION } from "@/data/legalContent";
import "@/styles/night-legal.css";

const LEGAL_NAV = [
  { key: "confidentialitate", label: "Confidențialitate" },
  { key: "termeni", label: "Termeni și condiții" },
  { key: "cookies", label: "Cookies" },
];

export default function LegalPage({ type = "confidentialitate" }) {
  const siteDetails = useManagedContent("siteDetails", CMS_DEFAULTS.siteDetails);
  const legalPages = useManagedContent("legalPages", CMS_DEFAULTS.legalPages);
  const email = siteDetails.email || EMAIL;
  const routeKey = Object.prototype.hasOwnProperty.call(LEGAL_PAGE_PRESENTATION, type) ? type : "confidentialitate";
  const documentKey = { confidentialitate: "privacy", termeni: "terms", cookies: "cookies" }[routeKey];
  const data = { ...LEGAL_PAGE_PRESENTATION[routeKey], ...legalPages[documentKey] };

  usePageMeta({
    title: `${data.title} — FireArtRo`,
    description: data.description,
    path: data.path,
  });

  return (
    <main className="legal-page" data-design="night-runway">
      <ScrollProgress />
      <Navbar />

      <header className="legal-hero">
        <div className="legal-hero-inner">
          <span>{data.eyebrow}</span>
          <h1>{data.title}</h1>
          <p>{data.description}</p>
          <small>{data.updatedLabel}</small>
        </div>
      </header>

      <div className="legal-layout">
        <aside className="legal-nav" aria-label="Documente legale">
          <span>Documente</span>
          {LEGAL_NAV.map((item) => (
            <Link
              key={item.key}
              to={LEGAL_PAGE_PRESENTATION[item.key].path}
              className={item.key === type ? "is-active" : undefined}
            >
              {item.label} <ArrowRight />
            </Link>
          ))}
        </aside>

        <article className="legal-article">
          {data.sections.map((section, index) => (
            <section key={section.id} aria-labelledby={`legal-section-${index}`}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <div>
                <h2 id={`legal-section-${index}`}>{section.heading}</h2>
                {section.paragraphs.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            </section>
          ))}

          {data.sources && data.sources.length > 0 && (
            <div className="legal-sources">
              {data.sources.map((item) => (
                <a
                  key={item.href}
                  className="legal-source"
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {item.label} <ExternalLink />
                </a>
              ))}
            </div>
          )}

          <div className="legal-contact">
            <Mail />
            <div>
              <span>Ai o solicitare legată de acest document?</span>
              <a href={`mailto:${email}`}>{email}</a>
            </div>
          </div>
        </article>
      </div>

      <PageEnd />
    </main>
  );
}
