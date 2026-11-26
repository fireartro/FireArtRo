import { CANONICAL_SITE_URL } from "./businessContent";

export const ORGANIZATION_ID = `${CANONICAL_SITE_URL}/#firma`;
const STORE_URL = `${CANONICAL_SITE_URL}/contact#locatii`;
const SEINI_ADDRESS = "Piața Unirii nr. 2, Seini, județul Maramureș";

export function locationMapHref(address) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

export function storeMarkup(details, phone) {
  if (!details.mainOffice) return null;
  const address = details.mainOffice === SEINI_ADDRESS
    ? { streetAddress: "Piața Unirii nr. 2", addressLocality: "Seini", addressRegion: "Maramureș", postalCode: "435400" }
    : { streetAddress: details.mainOffice };
  return {
    "@type": "Store",
    "@id": STORE_URL,
    name: details.name,
    url: STORE_URL,
    image: `${CANONICAL_SITE_URL}/icon-512.png`,
    telephone: phone || undefined,
    email: details.email,
    parentOrganization: { "@id": ORGANIZATION_ID },
    address: { "@type": "PostalAddress", ...address, addressCountry: "RO" },
    hasMap: locationMapHref(details.mainOffice),
  };
}
