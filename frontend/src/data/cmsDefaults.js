import {
  BUSINESS_HOURS,
  CONTACT_EVENT_TYPES,
  COOKIE_SETTINGS_DEFAULT,
  MEDIA_ITEMS,
  PACKAGE_ITEMS,
  SERVICE_INTEREST_OPTIONS,
  SITE_DETAILS,
  SOCIAL_LINKS,
  TESTIMONIAL_ITEMS,
} from "./businessContent";
import { NAV_LINKS } from "./content";
import { HOME_GALLERY, PARTNER_PLACEHOLDERS } from "./homeExperience";
import { FAQ_DEFAULTS } from "./faqContent";
import { LEGAL_PAGES_DEFAULT } from "./legalContent";

export const MEDIA_TEMPLATE = {
  id: "media", type: "image", title: "", shortDescription: "",
  category: "Artificii de noapte", tags: [], thumbnail: "", poster: "", src: "",
  youtubeUrl: "", alt: "", featured: false, date: "2026-09-03", order: 0,
  eventType: "", ctaLabel: "", ctaHref: "", width: null, height: null, aspectRatio: null,
};

export const PACKAGE_TEMPLATE = {
  id: "package", title: "", category: "Artificii de noapte", bestFor: "",
  shortDescription: "", visualImpact: "", duration: "", droneCount: null,
  effectsCount: null, badge: "", cta: "Cere ofertă", ctaHref: "/contact",
  imageMediaId: "", highlights: [], bonus: "", videoUrl: "", videoNote: "", moreVideoUrls: [],
};

export const PROMO_SLIDE_TEMPLATE = {
  id: "slide", type: "image", title: "", shortText: "", badge: "", mediaId: "",
  youtubeUrl: "", ctaLabel: "Vezi galeria", ctaHref: "/galerie",
};

const section = (eyebrow, title, ctaLabel = "", ctaHref = "", description = "") => ({
  eyebrow, title, description, ctaLabel, ctaHref,
});
const optionId = (value) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const options = (values, prefix) => values.map((label) => ({ id: `${prefix}-${optionId(label)}`, label }));
const links = (items, prefix) => items.map((item) => ({ id: `${prefix}-${optionId(item.label)}`, ...item }));

// The single, JSON-only SiteContent v1 fallback shared by public rendering and Admin.
// Empty published arrays are intentional: consumers must never repopulate them.
export const CMS_DEFAULTS = {
  schema_version: 1,
  siteDetails: {
    ...SITE_DETAILS,
    googleReviewsUrl: "",
    seoTitle: "Spectacole cu drone și artificii pentru evenimente | FireArtRo",
    seoDescription: "FireArtRo creează spectacole cu drone, artificii și efecte scenice pentru nunți, evenimente corporate și festivaluri din România.",
  },
  contactSettings: {
    phoneDisplay: "+40 0787 602 144",
    phoneTel: "+40787602144",
    whatsappNumber: "40787602144",
  },
  businessHours: BUSINESS_HOURS,
  socialLinks: SOCIAL_LINKS,
  navigation: { links: links(NAV_LINKS, "nav") },
  footer: {
    tagline: "Drone show, artificii și efecte construite pentru momentul potrivit.",
    exploreHeading: "Explorează",
    contactHeading: "Contact direct",
    socialHeading: "Urmărește",
    copyright: "FireArtRo",
    exploreLinks: links([
      { label: "Despre noi", href: "/#intro" },
      { label: "Pachete", href: "/pachete" },
      { label: "Galerie", href: "/galerie" },
      { label: "Blog", href: "/blog" },
      { label: "Întrebări", href: "/intrebari-frecvente" },
      { label: "Contact", href: "/contact" },
    ], "footer"),
    legalLinks: links([
      { label: "Confidențialitate", href: "/confidentialitate" },
      { label: "Termeni și condiții", href: "/termeni-si-conditii" },
      { label: "Cookies", href: "/cookies" },
      { label: "ANPC", href: "https://eservicii.anpc.ro/" },
      { label: "SAL", href: "https://reclamatiisal.anpc.ro/" },
    ], "legal"),
  },
  homePage: {
    hero: {
      eyebrow: "Drone · artificii · efecte scenice",
      titleLead: "Spectacole",
      titleTail: "în lumină.",
      description: "Momente care rămân.",
      primaryCtaLabel: "Cere oferta",
      primaryCtaHref: "/contact",
      secondaryCtaLabel: "Vezi galeria",
      secondaryCtaHref: "/galerie",
      // An empty reference retains the approved responsive film composition.
      backgroundMediaId: "",
    },
    gallery: section("Selecție FireArtRo", "Trei momente.\nO singură noapte.", "Vezi galeria", "/galerie"),
    packages: section("Pachete FireArtRo", "Fiecare noapte cere alt spectacol.", "Vezi toate pachetele", "/pachete"),
    about: {
      eyebrow: "Despre FireArtRo",
      title: "Suntem echipa din spatele spectacolului.",
      body: ["FireArtRo planifică și produce în România show-uri cu drone, artificii profesionale și efecte scenice. Coordonăm conceptul, partea tehnică, logistica și execuția pentru fiecare eveniment."],
    },
    partners: section("Un show se construiește împreună", "O rețea care prinde formă.", "", "", "Locații, organizatori și echipe tehnice intră în aceeași orbită."),
    brief: section("Următorul spectacol", "Spune-ne ce sărbătorești.\nNoi aprindem restul.", "Începe conversația", "/contact"),
    promoSlides: HOME_GALLERY.map((item) => ({
      ...PROMO_SLIDE_TEMPLATE,
      id: item.id,
      title: item.title,
      shortText: item.alt,
      badge: item.type,
      mediaId: MEDIA_ITEMS.find((media) => media.src === item.image).id,
    })),
  },
  galleryPage: {
    eyebrow: "Galerie FireArtRo",
    title: "Galerie",
    description: "Cadre reale din spectacole cu drone si artificii de zi sau de noapte.",
    seoTitle: "Galerie drone show si artificii | FireArtRo",
    seoDescription: "Imagini FireArtRo din spectacole cu drone, artificii si efecte scenice.",
    heroMediaId: "",
  },
  packagesPage: {
    eyebrow: "Formate FireArtRo",
    title: "Pachete",
    description: "Alege o direcție. Configurația finală se construiește după spațiu, ritm și brief.",
    seoTitle: "Pachete pentru drone show și artificii | FireArtRo",
    seoDescription: "Compară formatele FireArtRo pentru drone show, artificii și efecte scenice, apoi cere o configurație adaptată evenimentului.",
    heroMediaId: "",
  },
  faqPage: {
    eyebrow: "Întrebări",
    title: "Întrebări.",
    description: "Ce contează înainte de rezervare.",
    seoTitle: "Întrebări frecvente despre drone show și artificii — FireArtRo",
    seoDescription: "Răspunsuri despre rezervare, autorizații, vreme, siguranță, durată și costuri pentru spectacole cu drone, artificii și efecte speciale.",
    heroMediaId: "",
  },
  contactPage: {
    eyebrow: "Brief FireArtRo",
    title: "Ai data. Construim restul.",
    description: "Spune-ne reperele evenimentului, iar noi pregătim direcția potrivită.",
    formTitle: "Planificare eveniment",
    eventTypes: options(CONTACT_EVENT_TYPES, "event"),
    showOptions: options(SERVICE_INTEREST_OPTIONS, "show"),
    consentLabel: "Sunt de acord cu prelucrarea datelor conform",
    submitLabel: "Trimite cererea",
  },
  blogPage: {
    eyebrow: "Jurnal FireArtRo",
    title: "Blog",
    description: "Articole publicate de echipa FireArtRo.",
    seoTitle: "Blog — FireArtRo",
    seoDescription: "Articole FireArtRo despre spectacole cu drone, artificii și producția evenimentelor.",
    heroMediaId: "",
  },
  mediaItems: MEDIA_ITEMS.map((item) => ({ ...MEDIA_TEMPLATE, ...item })),
  packages: PACKAGE_ITEMS.map((item) => ({ ...PACKAGE_TEMPLATE, ...item })),
  faqs: FAQ_DEFAULTS,
  // Existing placeholders remain explicitly marked; no reviews or articles are invented.
  testimonials: TESTIMONIAL_ITEMS.map((item) => ({ ...item, source: item.source.toLowerCase() })),
  partners: PARTNER_PLACEHOLDERS.map((item) => ({
    id: item.id, name: item.name, logoPlaceholder: item.name, logoMediaId: "", replaceable: true,
  })),
  reviewSettings: {
    enabled: true, heading: "Recenzii verificate", description: "",
    googleEnabled: true, facebookEnabled: true, maxItems: 8,
  },
  cookieSettings: COOKIE_SETTINGS_DEFAULT,
  legalPages: LEGAL_PAGES_DEFAULT,
};
