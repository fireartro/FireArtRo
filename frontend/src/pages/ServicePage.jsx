import { Link, useParams } from "react-router-dom";
import NightButton from "@/components/night/NightButton";
import Navbar from "@/components/site/Navbar";
import PageEnd from "@/components/site/PageEnd";
import ScrollProgress from "@/components/site/ScrollProgress";
import { CANONICAL_SITE_URL } from "@/data/businessContent";
import { CMS_DEFAULTS } from "@/data/cmsDefaults";
import { findService, SERVICE_CATALOG } from "@/data/serviceCatalog";
import useManagedContent from "@/hooks/useManagedContent";
import usePageMeta from "@/hooks/usePageMeta";
import "@/styles/night-blog.css";

export default function ServicePage({ service: suppliedService } = {}) {
  const { slug } = useParams();
  const service = suppliedService || findService(slug);
  const siteDetails = useManagedContent("siteDetails", CMS_DEFAULTS.siteDetails);
  const packages = useManagedContent("packages", CMS_DEFAULTS.packages);
  const matchingPackages = service ? packages.filter((item) => item.category === service.category) : [];
  const title = service?.title || "Serviciul nu a fost găsit";
  const path = service?.path || `/servicii/${encodeURIComponent(slug || "necunoscut")}`;
  const packageHref = service ? `/pachete?categorie=${encodeURIComponent(service.category)}` : "/pachete";

  usePageMeta({
    title: `${title} | ${siteDetails.name}`,
    description: service?.description || "Consultă serviciile și pachetele disponibile pentru evenimentul tău.",
    path,
    noindex: !service,
    schema: service ? {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "Service",
          "@id": `${CANONICAL_SITE_URL}${path}#service`,
          name: title,
          serviceType: title,
          description: service.description,
          url: `${CANONICAL_SITE_URL}${path}`,
          provider: { "@type": "Organization", name: siteDetails.name, url: `${CANONICAL_SITE_URL}/` },
          areaServed: { "@type": "Country", name: siteDetails.areaServed },
        },
        {
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Acasă", item: `${CANONICAL_SITE_URL}/` },
            { "@type": "ListItem", position: 2, name: title, item: `${CANONICAL_SITE_URL}${path}` },
          ],
        },
      ],
    } : undefined,
  });

  return (
    <div className="fa-blog-route">
      <ScrollProgress />
      <Navbar />
      <main className="fa-blog-page" data-design="night-runway">
        <article className="fa-blog-article">
          <nav className="fa-blog-card__meta" aria-label="Fir de navigare">
            <Link className="fa-blog-back" to="/">Acasă</Link>
            <span aria-current="page">{title}</span>
          </nav>
          <header className="fa-blog-article__head">
            <p className="fa-blog-card__meta">{siteDetails.name} · Servicii</p>
            <h1>{title}</h1>
            <p>{service?.description || "Alege un serviciu din pachetele disponibile sau contactează echipa."}</p>
          </header>

          {service ? <>
            {service.sections.map((section, index) => (
              <section className="fa-blog-body" key={section.title} aria-labelledby={`service-section-${index}`}>
                <h2 className="fa-kicker" id={`service-section-${index}`}>{section.title}</h2>
                {section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
              </section>
            ))}

            {matchingPackages.length > 0 && (
              <section className="fa-blog-body" aria-labelledby="service-packages-title">
                <h2 className="fa-kicker" id="service-packages-title">Pachete din această categorie</h2>
                {matchingPackages.map((item) => (
                  <p key={item.id}><strong>{item.title}</strong>{item.duration ? ` · ${item.duration}` : ""}{item.shortDescription ? ` — ${item.shortDescription}` : ""}</p>
                ))}
              </section>
            )}

            <section className="fa-blog-body" aria-labelledby="service-questions-title">
              <h2 className="fa-kicker" id="service-questions-title">Întrebări despre serviciu</h2>
              {service.faq.map(({ q, a }, index) => (
                <section className="fa-blog-body" key={q} aria-labelledby={`service-question-${index}`}>
                  <h3 className="fa-blog-card__meta" id={`service-question-${index}`}>{q}</h3>
                  <p>{a}</p>
                </section>
              ))}
            </section>

            <section className="fa-blog-body" aria-labelledby="service-offer-title">
              <h2 className="fa-kicker" id="service-offer-title">Discută evenimentul cu {siteDetails.name}</h2>
              <p>Trimite data, localitatea, locația și momentul pe care îl pregătești. Configurația și disponibilitatea se confirmă direct cu echipa.</p>
              {siteDetails.email && <p>Pentru detalii, ne poți scrie la <a href={`mailto:${siteDetails.email}`}>{siteDetails.email}</a>.</p>}
              <p><NightButton to="/contact">Cere ofertă</NightButton></p>
              <p><NightButton to={packageHref} variant="secondary">Vezi opțiunile din pachete</NightButton></p>
            </section>

            <nav className="fa-blog-body" aria-label="Alte servicii">
              <h2 className="fa-kicker">Alte servicii</h2>
              {SERVICE_CATALOG.filter((entry) => entry.slug !== service.slug).map((entry) => (
                <Link className="fa-blog-card__link" key={entry.slug} to={entry.path}>{entry.title}</Link>
              ))}
              <p><Link className="fa-blog-card__link" to="/galerie">Vezi galeria</Link></p>
            </nav>
          </> : <p className="fa-blog-body"><NightButton to="/pachete">Vezi pachetele</NightButton></p>}
        </article>
      </main>
      <PageEnd />
    </div>
  );
}
