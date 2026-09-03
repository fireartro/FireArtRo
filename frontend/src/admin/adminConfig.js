import { CMS_DEFAULTS, MEDIA_TEMPLATE, PACKAGE_TEMPLATE, PROMO_SLIDE_TEMPLATE } from "@/data/cmsDefaults";

export const ADMIN_DEFAULTS = CMS_DEFAULTS;

const field = (type, key, label, options = {}) => ({ type, key, label, ...options });
const text = (key, label, options) => field("text", key, label, options);
const textarea = (key, label, options) => field("textarea", key, label, options);
const url = (key, label, options) => field("url", key, label, options);
const number = (key, label, options) => field("number", key, label, options);
const checkbox = (key, label, options) => field("checkbox", key, label, options);
const select = (key, label, options) => field("select", key, label, { options });
const lines = (key, label, options) => field("lines", key, label, options);
const mediaId = (key, label) => field("mediaId", key, label);
const object = (key, label, fields) => field("object", key, label, { fields });
const collection = (key, label, template, fields, options = {}) =>
  field("collection", key, label, { template, fields, titleKey: "title", ...options });
const moduleDefinition = (definition, description) => ({
  ...definition, kind: definition.type, description,
});
const id = () => text("id", "Identificator stabil", { required: true, maxLength: 80, readOnly: true });
const LINK_TEMPLATE = { id: "link", label: "", href: "" };
const LINK_FIELDS = [id(), text("label", "Text", { required: true }), url("href", "Destinație", { required: true })];
const OPTION_TEMPLATE = { id: "option", label: "" };
const OPTION_FIELDS = [id(), text("label", "Text", { required: true })];
const SECTION_FIELDS = [
  text("eyebrow", "Supratitlu"), text("title", "Titlu", { multiline: true }),
  textarea("description", "Descriere"), text("ctaLabel", "Text buton"), url("ctaHref", "Destinație buton"),
];
const PAGE_FIELDS = [
  text("eyebrow", "Supratitlu"), text("title", "Titlu"), textarea("description", "Descriere"),
  text("seoTitle", "Titlu SEO", { maxLength: 160 }), textarea("seoDescription", "Descriere SEO", { maxLength: 320 }),
  mediaId("heroMediaId", "Imagine principală"),
];
const LEGAL_FIELDS = [
  text("title", "Titlu"), text("updatedLabel", "Eticheta ultimei actualizări"),
  collection("sections", "Secțiuni", { id: "section", heading: "", paragraphs: [] }, [
    id(), text("heading", "Titlul secțiunii"), lines("paragraphs", "Paragrafe", {
      help: "Text simplu, câte un paragraf pe rând. Fără HTML.", rows: 8,
    }),
  ], { titleKey: "heading" }),
];

export const ADMIN_MODULES = {
  siteDetails: moduleDefinition(object("siteDetails", "Companie", [
    text("name", "Nume brand", { required: true }), url("siteUrl", "Adresă site"),
    text("email", "Email public", { inputType: "email", required: true }),
    url("googleReviewsUrl", "Link Google Reviews"), text("areaServed", "Zonă deservită"),
    text("legalName", "Denumire juridică"), text("registrationNumber", "Nr. Registrul Comerțului"),
    text("taxId", "CUI"), textarea("registeredOffice", "Sediu social"),
    textarea("mainOffice", "Sediu principal"), textarea("secondaryOffice", "Sediu secundar"),
    text("seoTitle", "Titlu SEO", { maxLength: 160 }), textarea("seoDescription", "Descriere SEO", { maxLength: 320 }),
  ]), "Identitate, contact, sedii și SEO"),
  contactSettings: moduleDefinition(object("contactSettings", "Contact direct", [
    text("phoneDisplay", "Telefon afișat"), text("phoneTel", "Telefon internațional", { inputType: "tel" }),
    text("whatsappNumber", "Număr WhatsApp", { inputType: "tel" }),
  ]), "Telefon și WhatsApp"),
  businessHours: moduleDefinition(object("businessHours", "Program", [
    text("label", "Program afișat"), textarea("note", "Notă de disponibilitate"),
    lines("schema", "Program pentru motoare de căutare", { help: "Exemplu: Mo-Fr 10:00-18:00" }),
  ]), "Ore și disponibilitate"),
  socialLinks: moduleDefinition(collection("socialLinks", "Rețele sociale",
    { id: "social", label: "", href: "", placeholder: false },
    [...LINK_FIELDS, checkbox("placeholder", "Este doar placeholder")],
    { titleKey: "label", subtitleKey: "href" },
  ), "Canale publice și linkuri"),
  navigation: moduleDefinition(object("navigation", "Navigare", [
    collection("links", "Linkuri", LINK_TEMPLATE, LINK_FIELDS, { titleKey: "label" }),
  ]), "Meniul principal"),
  footer: moduleDefinition(object("footer", "Footer", [
    textarea("tagline", "Descriere"), text("exploreHeading", "Titlu navigare"),
    text("contactHeading", "Titlu contact"), text("socialHeading", "Titlu rețele sociale"),
    text("copyright", "Text copyright"),
    collection("exploreLinks", "Linkuri de explorare", LINK_TEMPLATE, LINK_FIELDS, { titleKey: "label" }),
    collection("legalLinks", "Linkuri juridice", LINK_TEMPLATE, LINK_FIELDS, { titleKey: "label" }),
  ]), "Texte și linkuri de la finalul paginii"),
  homePage: moduleDefinition(object("homePage", "Prima pagină", [
    object("hero", "Introducere", [
      text("eyebrow", "Supratitlu"), text("titleLead", "Prima linie a titlului"),
      text("titleTail", "A doua linie a titlului"), textarea("description", "Descriere"),
      text("primaryCtaLabel", "Text buton principal"), url("primaryCtaHref", "Destinație principală"),
      text("secondaryCtaLabel", "Text buton secundar"), url("secondaryCtaHref", "Destinație secundară"),
      mediaId("backgroundMediaId", "Media de fundal"),
    ]),
    object("gallery", "Galerie", SECTION_FIELDS),
    object("packages", "Pachete", SECTION_FIELDS),
    object("about", "Despre noi", [
      text("eyebrow", "Supratitlu"), text("title", "Titlu"), lines("body", "Paragrafe", { rows: 6 }),
    ]),
    object("partners", "Parteneri", SECTION_FIELDS),
    object("brief", "Contact", SECTION_FIELDS),
    collection("promoSlides", "Cadre promovate", PROMO_SLIDE_TEMPLATE, [
      id(), select("type", "Tip", ["image", "video", "youtube", "promotion"]),
      text("title", "Titlu"), textarea("shortText", "Descriere"), text("badge", "Etichetă"),
      mediaId("mediaId", "Media"), url("youtubeUrl", "Link YouTube"),
      text("ctaLabel", "Text buton"), url("ctaHref", "Destinație buton"),
    ]),
  ]), "Texte, butoane și cadre de pe homepage"),
  galleryPage: moduleDefinition(object("galleryPage", "Pagina Galerie", PAGE_FIELDS), "Introducere și SEO"),
  packagesPage: moduleDefinition(object("packagesPage", "Pagina Pachete", PAGE_FIELDS), "Introducere și SEO"),
  faqPage: moduleDefinition(object("faqPage", "Pagina Întrebări", PAGE_FIELDS), "Introducere și SEO"),
  contactPage: moduleDefinition(object("contactPage", "Pagina Contact", [
    text("eyebrow", "Supratitlu"), text("title", "Titlu"), textarea("description", "Descriere"),
    text("formTitle", "Titlu formular"),
    collection("eventTypes", "Tipuri de eveniment", OPTION_TEMPLATE, OPTION_FIELDS, { titleKey: "label" }),
    collection("showOptions", "Spectacole", OPTION_TEMPLATE, OPTION_FIELDS, { titleKey: "label" }),
    textarea("consentLabel", "Text consimțământ"), text("submitLabel", "Text trimitere"),
  ]), "Formular, opțiuni și texte"),
  blogPage: moduleDefinition(object("blogPage", "Pagina Blog", PAGE_FIELDS), "Introducere și SEO; articolele au editor separat"),
  mediaItems: moduleDefinition(collection("mediaItems", "Galerie / media", MEDIA_TEMPLATE, [
    id(), select("type", "Tip", ["image", "video", "youtube", "promo"]),
    text("title", "Titlu"), textarea("shortDescription", "Descriere"),
    select("category", "Categorie", ["Artificii de zi", "Artificii de noapte", "Drone show", "Drone + artificii", "Efecte speciale", "Corporate / Festival", "Festival", "Nuntă", "Corporate", "Promoții"]),
    field("tags", "tags", "Etichete"), field("media", "thumbnail", "Miniatură"),
    field("media", "poster", "Poster"), field("media", "src", "Fișier media"),
    url("youtubeUrl", "Link YouTube"), textarea("alt", "Text alternativ", { required: true }),
    checkbox("featured", "Evidențiat"), field("date", "date", "Dată"),
    number("order", "Ordine", { min: 0 }), text("eventType", "Tip eveniment"),
    text("ctaLabel", "Text buton"), url("ctaHref", "Destinație buton"),
    number("width", "Lățime", { min: 1, nullable: true }), number("height", "Înălțime", { min: 1, nullable: true }),
    number("aspectRatio", "Raport de aspect", { min: 0.01, step: "any", nullable: true }),
  ], { subtitleKey: "category", previewKey: "thumbnail" }), "Catalogul comun de imagini și videoclipuri"),
  packages: moduleDefinition(collection("packages", "Pachete", PACKAGE_TEMPLATE, [
    id(), text("title", "Nume pachet"), select("category", "Categorie", ["Artificii de zi", "Artificii de noapte", "Show drone", "Drone + artificii", "Efecte speciale", "Corporate / Festival"]),
    text("bestFor", "Potrivit pentru"), textarea("shortDescription", "Descriere"),
    text("visualImpact", "Atmosferă / impact"), text("duration", "Durată"),
    number("droneCount", "Număr drone", { min: 0, nullable: true }),
    number("effectsCount", "Grupe de efecte", { min: 0, nullable: true }),
    text("badge", "Etichetă"), text("cta", "Text buton"), url("ctaHref", "Destinație buton"),
    mediaId("imageMediaId", "Imagine proprie"), field("tags", "highlights", "Caracteristici"),
    textarea("bonus", "Bonus / elemente incluse"), url("videoUrl", "Video principal"),
    textarea("videoNote", "Notă video"), lines("moreVideoUrls", "Alte videoclipuri", { help: "Câte un link pe rând." }),
  ], { subtitleKey: "category" }), "Opțiuni și configurații comerciale"),
  faqs: moduleDefinition(collection("faqs", "Întrebări", { id: "faq", q: "", a: "" }, [
    id(), textarea("q", "Întrebare"), textarea("a", "Răspuns", { rows: 5 }),
  ], { titleKey: "q", subtitleKey: "a" }), "Întrebări frecvente și răspunsuri"),
  testimonials: moduleDefinition(collection("testimonials", "Recenzii", {
    id: "testimonial", name: "", eventType: "", quote: "", source: "client", replaceable: true,
  }, [
    id(), text("name", "Nume"), text("eventType", "Tip eveniment"), textarea("quote", "Recenzie"),
    select("source", "Sursă", ["client", "google", "facebook", "other"]),
    checkbox("replaceable", "Conținut demonstrativ"),
  ], { titleKey: "name", subtitleKey: "eventType" }), "Feedback publicat responsabil"),
  partners: moduleDefinition(collection("partners", "Parteneri", {
    id: "partner", name: "", logoPlaceholder: "LOGO", logoMediaId: "", replaceable: true,
  }, [
    id(), text("name", "Nume"), text("logoPlaceholder", "Text placeholder"),
    mediaId("logoMediaId", "Logo"), checkbox("replaceable", "Conținut demonstrativ"),
  ], { titleKey: "name" }), "Identități și logo-uri aprobate"),
  reviewSettings: moduleDefinition(object("reviewSettings", "Setări recenzii", [
    checkbox("enabled", "Afișează recenziile"), text("heading", "Titlu"),
    textarea("description", "Descriere"), checkbox("googleEnabled", "Google"),
    checkbox("facebookEnabled", "Facebook"), number("maxItems", "Număr maxim", { min: 1, max: 20 }),
  ]), "Afișare și surse publice; fără credențiale"),
  cookieSettings: moduleDefinition(object("cookieSettings", "Cookies", [
    text("title", "Titlu"), textarea("summary", "Rezumat"),
    text("necessaryLabel", "Titlu strict necesare"), textarea("necessaryDescription", "Descriere strict necesare"),
    text("analyticsLabel", "Titlu analiză"), textarea("analyticsDescription", "Descriere analiză"),
    text("marketingLabel", "Titlu marketing"), textarea("marketingDescription", "Descriere marketing"),
    number("retentionDays", "Păstrare preferință (zile)", { min: 1, max: 730 }),
  ]), "Textele bannerului de consimțământ"),
  legalPages: moduleDefinition(object("legalPages", "Documente legale", [
    object("privacy", "Confidențialitate", LEGAL_FIELDS),
    object("terms", "Termeni și condiții", LEGAL_FIELDS),
    object("cookies", "Politica de cookies", LEGAL_FIELDS),
  ]), "Texte juridice integrale, fără HTML"),
  blog: { label: "Articole Blog", description: "Articole, coperte și publicare", kind: "remote", type: "remote" },
};

export const MODULE_ORDER = [
  "siteDetails", "contactSettings", "businessHours", "socialLinks", "navigation", "footer",
  "homePage", "galleryPage", "packagesPage", "faqPage", "contactPage", "blogPage",
  "mediaItems", "packages", "faqs", "testimonials", "partners", "reviewSettings",
  "cookieSettings", "legalPages", "blog",
];

let itemSequence = 0;
export const makeAdminItem = (moduleKey, index = 0) => {
  const template = ADMIN_MODULES[moduleKey]?.template || {};
  const next = JSON.parse(JSON.stringify(template));
  const suffix = globalThis.crypto?.randomUUID?.()
    || `${Date.now().toString(36)}-${(++itemSequence).toString(36)}`;
  if (Object.prototype.hasOwnProperty.call(next, "id")) next.id = `${next.id || moduleKey}-${suffix}`;
  if (Object.prototype.hasOwnProperty.call(next, "order")) next.order = index + 1;
  return next;
};
