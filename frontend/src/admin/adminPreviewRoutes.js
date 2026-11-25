import { SERVICE_CATALOG } from "@/data/serviceCatalog";

export const ARTICLE_PREVIEW_PATH = "/blog/previzualizare-articol";

export const ADMIN_PREVIEW_ROUTES = {
  "/": "Acasă",
  "/galerie": "Galerie",
  "/pachete": "Pachete",
  "/intrebari-frecvente": "Întrebări",
  "/contact": "Contact",
  "/blog": "Blog",
  "/confidentialitate": "Confidențialitate",
  "/termeni-si-conditii": "Termeni și condiții",
  "/cookies": "Politica de cookies",
  ...Object.fromEntries(SERVICE_CATALOG.map(service => [service.path, service.title])),
};

const sectionPaths = {
  galleryPage: "/galerie", media: "/galerie", mediaItems: "/galerie",
  packagesPage: "/pachete", packages: "/pachete",
  faqPage: "/intrebari-frecvente", faqs: "/intrebari-frecvente",
  contactPage: "/contact", contactSettings: "/contact", businessHours: "/contact",
  blogPage: "/blog", blog: "/blog", legalPages: "/termeni-si-conditii",
  servicePages: "/servicii/artificii-nunta",
};

export function previewTargetForSection(section) {
  if (section === "partners") return { path: "/", anchor: "#parteneri" };
  if (["testimonials", "reviewSettings"].includes(section)) return { path: "/", anchor: "#recenzii" };
  return { path: sectionPaths[section] || "/" };
}
