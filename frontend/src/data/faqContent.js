import { FAQS } from "./content";

const EDITORIAL_ANSWERS = {
  "Cu cât timp înainte trebuie rezervat spectacolul?":
    "Pentru majoritatea evenimentelor, recomandăm să ne contactezi cu 3–4 săptămâni înainte. Pentru date aglomerate sau producții ample, este util un interval de 1–2 luni.",
  "Se pot combina dronele cu artificiile?":
    "Da. Dronele și artificiile pot fi sincronizate într-un singur moment, în funcție de locație și condițiile tehnice.",
  "Ce se întâmplă dacă vremea este nefavorabilă?":
    "Dacă vântul sau alte condiții nu permit desfășurarea în siguranță, adaptăm sau reprogramăm momentul conform variantei stabilite înainte de eveniment.",
  "Sunt necesare autorizații?":
    "Da. Stabilim autorizațiile și responsabilitățile necesare după verificarea locației, conform cerințelor aplicabile fiecărui tip de spectacol.",
  "Se pot face spectacole pentru nunți?":
    "Da. Formatul se poate integra la primul dans, într-un moment intermediar sau la finalul serii.",
  "Se pot face spectacole corporate sau festivaluri?":
    "Da. Configurăm show-uri pentru evenimente corporate, lansări, gale și festivaluri, în funcție de spațiu și public.",
  "Cât durează un spectacol?":
    "De regulă, între 3 și 12 minute. Durata finală depinde de concept, locație și buget.",
  "Ce informații trebuie trimise pentru ofertă?":
    "Avem nevoie de tipul evenimentului, data, locația aproximativă și formatul dorit. Clarificăm restul într-o discuție scurtă.",
  "Sunt disponibile efecte speciale indoor?":
    "Da, dacă spațiul și regulile locației permit. Verificăm distanțele și condițiile tehnice înainte de confirmare.",
  "De ce prețul este personalizat?":
    "Oferta ține cont de locație, durată, numărul de drone, tipul efectelor, cerințele de siguranță și logistică.",
};


const FAQ_IDS = ["booking", "combined", "weather", "permits", "weddings", "corporate", "duration", "quote", "indoor", "price"];

// Preserve the answers actually shown by the public FAQ, without overriding later edits.
export const FAQ_DEFAULTS = FAQS.map((item, index) => ({
  id: `faq-${FAQ_IDS[index]}`,
  q: item.q,
  a: EDITORIAL_ANSWERS[item.q] || item.a,
}));
