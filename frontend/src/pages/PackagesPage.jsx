import { CMS_DEFAULTS } from "@/data/cmsDefaults";
import Navbar from "@/components/site/Navbar";
import ScrollProgress from "@/components/site/ScrollProgress";
import Packages from "@/components/site/Packages";
import PageEnd from "@/components/site/PageEnd";
import usePageMeta from "@/hooks/usePageMeta";
import useManagedContent from "@/hooks/useManagedContent";

import "@/styles/night-packages.css";

export default function PackagesPage() {
  const copy = useManagedContent("packagesPage", CMS_DEFAULTS.packagesPage);
  const packages = useManagedContent("packages", CMS_DEFAULTS.packages);
  const siteDetails = useManagedContent("siteDetails", CMS_DEFAULTS.siteDetails);

  usePageMeta({
    title: copy.seoTitle,
    description: copy.seoDescription,
    path: "/pachete",
    schema: {
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: "Pachete FireArtRo",
      url: `${siteDetails.siteUrl}/pachete`,
      itemListElement: packages.map((item, index) => ({
        "@type": "ListItem",
        position: index + 1,
        item: {
          "@type": "Service",
          name: item.title,
          serviceType: item.category,
          description: item.shortDescription,
        },
      })),
    },
  });

  return (
    <main className="nr-packages-page" data-design="night-runway">
      <ScrollProgress />
      <Navbar />
      <Packages items={packages} />
      <PageEnd />
    </main>
  );
}
