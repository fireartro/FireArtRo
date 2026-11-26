import Navbar from "@/components/site/Navbar";
import ScrollProgress from "@/components/site/ScrollProgress";
import QuoteForm from "@/components/site/QuoteForm";
import PageEnd from "@/components/site/PageEnd";
import { Toaster } from "@/components/ui/sonner";
import usePageMeta from "@/hooks/usePageMeta";
import useManagedContent from "@/hooks/useManagedContent";
import { CMS_DEFAULTS } from "@/data/cmsDefaults";
import { CANONICAL_SITE_URL } from "@/data/businessContent";
import { ORGANIZATION_ID, storeMarkup } from "@/data/storeLocation";
import "@/styles/night-contact.css";

export default function ContactPage() {
  const copy = useManagedContent("contactPage", CMS_DEFAULTS.contactPage);
  const siteDetails = useManagedContent("siteDetails", CMS_DEFAULTS.siteDetails);
  const { phoneTel } = useManagedContent("contactSettings", CMS_DEFAULTS.contactSettings);
  const store = storeMarkup(siteDetails, phoneTel);
  const description = store ? `Magazin ${siteDetails.name} la ${siteDetails.mainOffice}. ${copy.description}` : copy.description;
  usePageMeta({
    title: `${store ? "Contact și magazin" : "Contact"} | ${siteDetails.name}`,
    description,
    path: "/contact",
    schema: {
      "@context": "https://schema.org",
      "@graph": [
        { "@type": "ContactPage", url: `${CANONICAL_SITE_URL}/contact`, name: `Contact ${siteDetails.name}`, about: { "@id": ORGANIZATION_ID } },
        ...(store ? [store] : []),
      ],
    },
  });

  return (
    <>
      <main className="contact-page nr-contact-page" data-design="night-runway">
        <ScrollProgress />
        <Navbar />
        <QuoteForm />
        <PageEnd />
      </main>
      <Toaster position="top-center" richColors />
    </>
  );
}
