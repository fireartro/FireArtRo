import { MapPin } from "lucide-react";
import NightButton from "@/components/night/NightButton";
import { REGIONAL_SERVICES } from "@/data/regionalServices";
import { locationMapHref } from "@/data/storeLocation";

export default function ContactLocations({ siteDetails }) {
  const locations = [
    ["Magazin și punct de lucru", siteDetails.mainOffice],
    ["Sediu social", siteDetails.registeredOffice],
    ["Locație administrativă", siteDetails.secondaryOffice],
  ].filter(([, address]) => address);

  return (
    <section className="nr-contact-locations" id="locatii" aria-labelledby="contact-locations-title">
      <h2 className="nr-contact-kicker" id="contact-locations-title">Locații FireArtRo</h2>
      <div className="nr-contact-direct">
        {locations.map(([label, address]) => (
          <NightButton key={label} href={locationMapHref(address)} target="_blank" rel="noopener noreferrer"
            variant="secondary" showArrow={false} className="nr-contact-direct__action">
            <MapPin aria-hidden="true" />
            <span className="nr-contact-direct__copy">
              <span className="nr-contact-direct__label">{label}</span>
              <span className="nr-contact-direct__value">{address}</span>
            </span>
          </NightButton>
        ))}
      </div>
      <nav className="nr-contact-counties" aria-label="Artificii pe județe">
        {REGIONAL_SERVICES.map(service => <a key={service.slug} href={service.path}>Artificii {service.county}</a>)}
      </nav>
    </section>
  );
}
