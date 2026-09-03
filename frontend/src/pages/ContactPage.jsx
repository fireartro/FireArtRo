import Navbar from "@/components/site/Navbar";
import ScrollProgress from "@/components/site/ScrollProgress";
import QuoteForm from "@/components/site/QuoteForm";
import PageEnd from "@/components/site/PageEnd";
import usePageMeta from "@/hooks/usePageMeta";
import useManagedContent from "@/hooks/useManagedContent";
import { CMS_DEFAULTS } from "@/data/cmsDefaults";
import "@/styles/night-contact.css";

export default function ContactPage() {
  const copy = useManagedContent("contactPage", CMS_DEFAULTS.contactPage);
  const siteDetails = useManagedContent("siteDetails", CMS_DEFAULTS.siteDetails);
  usePageMeta({
    title: `${copy.title} | ${siteDetails.name}`,
    description: copy.description,
    path: "/contact",
  });

  return (
    <main className="contact-page nr-contact-page" data-design="night-runway">
      <ScrollProgress />
      <Navbar />
      <QuoteForm />
      <PageEnd />
    </main>
  );
}
