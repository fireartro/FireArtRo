// Owner-supplied collaborations. Verified graphics only; see assets provenance.
const asset = (file) => `/media/partners/${file}`;
export const PARTNER_GROUPS = [
  { id: "venues", title: "Locații & evenimente" },
  { id: "brands", title: "Branduri & companii" },
  { id: "cities", title: "Comunități & instituții" },
  { id: "other", title: "Colaboratori" },
];
export const PARTNER_CATALOG = [
  { id: "capricci", name: "Restaurant Capricci", group: "venues", logo: asset("capricci.png"), theme: "light", aliases: ["Restaurant capricii"] },
  { id: "intooit", name: "INTOOIT", group: "venues", logo: asset("intooit.png"), theme: "light", aliases: ["Into it"] },
  { id: "esedra", name: "Complex Esedra", group: "venues", logo: asset("esedra.webp"), theme: "light", aliases: ["Esedra"] },
  { id: "artistic", name: "Artistic", group: "venues", logo: asset("artistic.jpg"), theme: "light", aliases: ["Artistic — Satu Mare"] },
  { id: "shopping-city-satu-mare", name: "Shopping City Satu Mare", group: "brands", logo: asset("shopping-city-satu-mare.png"), theme: "light", aliases: ["Shopping city"] },
  { id: "infinity", name: "Infinity Ballroom", group: "venues", logo: "", aliases: ["Infinity Ballroom Satu Mare", "Infinity ballrom"] },
  { id: "seini", name: "Primăria Seini", group: "cities", logo: asset("seini-stema.jpg"), theme: "light" },
  { id: "ardud", name: "Primăria Ardud", group: "cities", logo: asset("ardud.jpg"), theme: "light" },
  { id: "valea-vinului", name: "Primăria Valea Vinului", group: "cities", logo: asset("valea-vinului.png"), theme: "light" },
  { id: "baia-mare", name: "Primăria Baia Mare", group: "cities", logo: asset("baia-mare.png"), theme: "light", aliases: ["Municipiul Baia Mare"] },
  { id: "auchan", name: "Auchan", group: "brands", logo: asset("auchan.svg"), theme: "light" },
  { id: "kaufland", name: "Kaufland", group: "brands", logo: asset("kaufland.svg"), theme: "light" },
  { id: "dedeman", name: "Dedeman", group: "brands", logo: asset("dedeman.svg"), theme: "light" },
  { id: "value-centre", name: "Value Center", group: "brands", logo: asset("value-centre-baia-mare.jpg"), theme: "light" },
  { id: "vivo", name: "VIVO!", group: "brands", logo: asset("vivo.svg"), theme: "light", aliases: ["Vivo"] },
  { id: "metro", name: "METRO", group: "brands", logo: asset("metro.svg"), theme: "dark" },
  { id: "remarkt", name: "Remarkt", group: "brands", logo: asset("remarkt.png"), theme: "light" },
  { id: "capus", name: "Motel Căpuș", group: "venues", logo: asset("capus.png"), theme: "dark", aliases: ["Complex Turistic Căpuș"] },
  { id: "wildhills", name: "Wild Hills", group: "venues", logo: asset("wildhills.svg"), theme: "light" },
  { id: "colt-de-rai", name: "Colț de Rai", group: "venues", logo: asset("colt-de-rai-negresti.jpg"), theme: "light", aliases: ["Colț de Rai Negrești-Oaș"] },
  { id: "palatul", name: "Palat Ioan Festeleu", group: "venues", logo: "", aliases: ["Palatul Ioan Festeleu"] },
  { id: "green-house", name: "Green House Events & Ballroom", group: "venues", logo: asset("green-house.png"), theme: "light", aliases: ["Greenhouse Var Jibou"] },
  { id: "alpin-recycling", name: "Alpin Recycling", group: "brands", logo: asset("alpin-recycling.png"), theme: "light" },
  { id: "aquastar", name: "AquaStar", group: "brands", logo: asset("aquastar.png"), theme: "dark", aliases: ["AquaStar Satu Mare"] },
  { id: "polipol", name: "POLIPOL", group: "brands", logo: asset("polipol.svg"), theme: "light", aliases: ["Polipol mobilă"] },
  { id: "remax", name: "RE/MAX", group: "brands", logo: asset("remax.png"), theme: "light", aliases: ["Remax"] },
];
const normalize = name => name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
const catalogueByName = new Map(PARTNER_CATALOG.flatMap(partner => [partner.name, ...(partner.aliases || [])].map(name => [normalize(name), partner])));

// Only the untouched, exact old CMS seed is migrated. Real edits always win.
export function isOriginalPartnerSeed(partners) {
  return partners.length === 12 && partners.every((partner, index) => {
    const seedName = `PARTENER ${String(index + 1).padStart(2, "0")}`;
    return Object.keys(partner).length === 5 && partner.id === `partner-${index + 1}` && partner.name === seedName && partner.logoPlaceholder === seedName && partner.replaceable === true && partner.logoMediaId === "";
  });
}
export function resolveDisplayPartners(partners, mediaItems) {
  if (isOriginalPartnerSeed(partners)) return PARTNER_CATALOG;
  const mediaById = new Map(mediaItems.map(item => [item.id, item]));
  return partners.map(partner => {
    const known = catalogueByName.get(normalize(partner.name));
    const uploaded = mediaById.get(partner.logoMediaId);
    // An explicit missing/deleted Admin reference must not resurrect a logo.
    const logo = partner.logoMediaId ? (uploaded?.type === "image" ? uploaded.src : "") : (known?.logo || "");
    // Original logo variants keep their verified backing. Unknown transparent
    // uploads use a middle-tone surface, readable for both white and dark marks.
    const theme = partner.logoMediaId ? (known?.logo && uploaded?.src === known.logo ? known.theme : "neutral") : known?.theme;
    return { ...known, ...partner, logo, theme, group: known?.group || "other" };
  });
}
