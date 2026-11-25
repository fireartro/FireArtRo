import { useMemo } from "react";
import useReducedMotion from "@/hooks/useReducedMotion";
import { CMS_DEFAULTS } from "@/data/cmsDefaults";
import { resolveDisplayPartners, resolvePartnerCopy } from "@/data/partnerCatalog";
import useManagedContent from "@/hooks/useManagedContent";
import { useCookieConsent } from "@/lib/cookieConsent";
import { isOptionalGoogleMedia } from "@/lib/optionalGoogleMedia";
import PartnerScrollScene from "./PartnerScrollScene";
import "@/styles/partner-scroll.css";

export default function HomePartners() {
  const homePage = useManagedContent("homePage", CMS_DEFAULTS.homePage);
  const managedPartners = useManagedContent("partners", CMS_DEFAULTS.partners);
  const mediaItems = useManagedContent("mediaItems", CMS_DEFAULTS.mediaItems);
  const marketingAllowed = useCookieConsent()?.marketing === true;
  const reduceMotion = useReducedMotion();
  const allPartners = useMemo(() => resolveDisplayPartners(managedPartners, mediaItems), [managedPartners, mediaItems]);
  const partners = useMemo(() => {
    if (marketingAllowed || !allPartners.some(partner => isOptionalGoogleMedia(partner.logo))) return allPartners;
    return allPartners.map(partner => isOptionalGoogleMedia(partner.logo) ? { ...partner, logo: "" } : partner);
  }, [allPartners, marketingAllowed]);
  const copy = resolvePartnerCopy(homePage.partners);
  if (!partners.length) return null;
  return <section className="fa-partners fa-partners-gallery" id="parteneri" data-home-scene="partners" data-testid="home-partners" aria-labelledby="fa-partners-title">
    <PartnerScrollScene partners={partners} copy={copy} reduceMotion={reduceMotion} />
  </section>;
}
