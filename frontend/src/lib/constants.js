import { CONTACT_SETTINGS_DEFAULT, SITE_DETAILS, SOCIAL_LINKS } from "@/data/businessContent";

export const WHATSAPP_NUMBER = CONTACT_SETTINGS_DEFAULT.whatsappNumber;
export const PHONE_DISPLAY = CONTACT_SETTINGS_DEFAULT.phoneDisplay;
export const PHONE_TEL = CONTACT_SETTINGS_DEFAULT.phoneTel;
export const EMAIL = SITE_DETAILS.email;
export const INSTAGRAM = SOCIAL_LINKS.find((item) => item.id === "instagram")?.href || "";
export const FACEBOOK = SOCIAL_LINKS.find((item) => item.id === "facebook")?.href || "";
export const YOUTUBE = SOCIAL_LINKS.find((item) => item.id === "youtube")?.href || "";

export const LOGO_URL = "/media/sigla-fireartro.webp";
export const LOGO_SRC_SET = "/media/sigla-fireartro-180.webp?v=20260906 180w, /media/sigla-fireartro-360.webp?v=20260906 360w, /media/sigla-fireartro.webp?v=20260906 720w";

export const buildWhatsappLink = (number, msg) =>
  number
    ? `https://wa.me/${String(number).replace(/\D/g, "")}?text=${encodeURIComponent(
        msg || "Bună! Aș dori o ofertă pentru un spectacol FireArtRo."
      )}`
    : "";

export const whatsappLink = (msg) => buildWhatsappLink(WHATSAPP_NUMBER, msg);
