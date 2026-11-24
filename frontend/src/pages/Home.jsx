import { CMS_DEFAULTS } from "@/data/cmsDefaults";
import { CANONICAL_SITE_URL } from "@/data/businessContent";
import Navbar from "@/components/site/Navbar";
import Hero from "@/components/site/Hero";
import PageEnd from "@/components/site/PageEnd";
import SocialDock from "@/components/site/SocialDock";
import ScrollProgress from "@/components/site/ScrollProgress";
import HomeRunway from "@/components/night/HomeRunway";
import usePageMeta from "@/hooks/usePageMeta";
import useManagedContent from "@/hooks/useManagedContent";

import "@/styles/night-home.css";
import "@/styles/night-home-film.css";

export default function Home() {
  const siteDetails = useManagedContent("siteDetails", CMS_DEFAULTS.siteDetails);
  const businessHours = useManagedContent("businessHours", CMS_DEFAULTS.businessHours);
  const socialLinks = useManagedContent("socialLinks", CMS_DEFAULTS.socialLinks);

  usePageMeta({
    title: siteDetails.seoTitle,
    description: siteDetails.seoDescription,
    path: "/",
    schema: {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": ["Organization", "LocalBusiness", "ProfessionalService"],
          name: siteDetails.name,
          legalName: siteDetails.legalName,
          url: CANONICAL_SITE_URL,
          logo: `${CANONICAL_SITE_URL}/icon-512.png`,
          email: siteDetails.email,
          taxID: siteDetails.taxId,
          address: {
            "@type": "PostalAddress",
            streetAddress: siteDetails.mainOffice,
            addressCountry: "RO",
          },
          sameAs: socialLinks.map((profile) => profile.href),
          areaServed: { "@type": "Country", name: siteDetails.areaServed },
          openingHours: businessHours.schema,
          description:
            "Show-uri de artificii profesionale, show-uri de drone și alte efecte pirotehnice pentru evenimente.",
        },
        {
          "@type": "Service",
          name: "Show-uri de artificii profesionale și drone",
          provider: { "@type": "Organization", name: siteDetails.name },
          areaServed: { "@type": "Country", name: siteDetails.areaServed },
        },
      ],
    },
  });

  return (
    <main className="nr-home" data-design="night-runway">
      <ScrollProgress />
      <Navbar />
      <Hero />
      <HomeRunway />
      <PageEnd showBlog />
      <SocialDock />
    </main>
  );
}
