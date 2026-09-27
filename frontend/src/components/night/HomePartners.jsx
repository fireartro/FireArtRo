import { useMemo } from "react";
import { useReducedMotion } from "framer-motion";
import { CMS_DEFAULTS } from "@/data/cmsDefaults";
import { isOriginalPartnerSeed, resolveDisplayPartners } from "@/data/partnerCatalog";
import useManagedContent from "@/hooks/useManagedContent";
import PartnerCloud from "./PartnerCloud";
import "@/styles/night-partners.css";

export default function HomePartners() {
  const homePage = useManagedContent("homePage", CMS_DEFAULTS.homePage);
  const managedPartners = useManagedContent("partners", CMS_DEFAULTS.partners);
  const mediaItems = useManagedContent("mediaItems", CMS_DEFAULTS.mediaItems);
  const reduceMotion = useReducedMotion();
  const partners = useMemo(() => resolveDisplayPartners(managedPartners, mediaItems), [managedPartners, mediaItems]);
  const copy = homePage.partners;
  const untouchedSeed = isOriginalPartnerSeed(managedPartners);
  const title = untouchedSeed && copy.title === CMS_DEFAULTS.homePage.partners.title ? "Împreună, dincolo de spectacol." : copy.title;
  if (!partners.length) return null;
  return <section className="fa-partners fa-partners-gallery" id="parteneri" data-home-scene="partners" data-testid="home-partners" aria-labelledby="fa-partners-title">
    <PartnerCloud partners={partners} copy={copy} title={title} reduceMotion={reduceMotion} />
  </section>;
}
