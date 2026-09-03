import { CMS_DEFAULTS } from "@/data/cmsDefaults";
import { ArrowUpRight, Mail, Phone } from "lucide-react";
import { OPEN_COOKIE_SETTINGS_EVENT } from "@/components/site/CookieConsent";
import { WhatsAppIcon } from "@/components/site/BrandIcons";

import useManagedContent from "@/hooks/useManagedContent";
import { buildWhatsappLink, LOGO_URL } from "@/lib/constants";
import "@/styles/night-footer.css";

export const Footer = () => {
  const copy = useManagedContent("footer", CMS_DEFAULTS.footer);
  const siteDetails = useManagedContent("siteDetails", CMS_DEFAULTS.siteDetails);
  const managedContactSettings = useManagedContent("contactSettings", CMS_DEFAULTS.contactSettings);
  const socialLinks = useManagedContent("socialLinks", CMS_DEFAULTS.socialLinks).filter((item) => item.href);
  const phoneDisplay = managedContactSettings.phoneDisplay || CMS_DEFAULTS.contactSettings.phoneDisplay;
  const phoneHref = managedContactSettings.phoneTel
    || CMS_DEFAULTS.contactSettings.phoneTel
    || phoneDisplay.replace(/\s/g, "");
  const whatsAppHref = buildWhatsappLink(
    managedContactSettings.whatsappNumber || CMS_DEFAULTS.contactSettings.whatsappNumber,
  );
  const email = siteDetails.email || "contact@fireart.ro";
  const phoneTarget = phoneDisplay && phoneHref ? `tel:${phoneHref}` : "/contact";
  const whatsappTarget = whatsAppHref || "/contact";

  return (
    <footer className="fa-footer" data-testid="night-runway-footer">
      <div className="fa-footer__frame nr-shell">
        <div className="fa-footer__upper">
          <div className="fa-footer__mast">
            <a className="fa-footer__brand" href="/#acasa" aria-label="FireArtRo, pagina principală">
              <img src={LOGO_URL} alt="FireArtRo" width="720" height="311" loading="lazy" decoding="async" />
            </a>
            <p>{copy.tagline}</p>
          </div>

          <div className="fa-footer__directory">
            <nav className="fa-footer__column" aria-label="Explorează">
              <p>{copy.exploreHeading}</p>
              {copy.exploreLinks.map((item) => <a key={item.id} href={item.href}>{item.label}</a>)}
            </nav>

            <div className="fa-footer__column fa-footer__contact">
              <p>{copy.contactHeading}</p>
              <a href={`mailto:${email}`}>
                <Mail aria-hidden="true" />
                <span>{email}</span>
              </a>
              <a href={phoneTarget} aria-label={phoneDisplay ? `Sună la ${phoneDisplay}` : "Telefon"}>
                <Phone aria-hidden="true" />
                <span>{phoneDisplay || "Telefon"}</span>
              </a>
              <a
                href={whatsappTarget}
                {...(whatsAppHref ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                aria-label="WhatsApp"
              >
                <WhatsAppIcon aria-hidden="true" />
                <span>WhatsApp</span>
                {whatsAppHref && <ArrowUpRight className="fa-footer__external" aria-hidden="true" />}
              </a>
            </div>

            <nav className="fa-footer__column" aria-label="Urmărește">
              <p>{copy.socialHeading}</p>
              {socialLinks.map((item) => (
                <a key={item.id} href={item.href} target="_blank" rel="noopener noreferrer">{item.label}</a>
              ))}
            </nav>
          </div>
        </div>

        <div className="fa-footer__bottom">
          <span>© {new Date().getFullYear()} {copy.copyright}</span>
          <nav className="fa-footer__legal" aria-label="Informații legale">
            {copy.legalLinks.map((item) => (
              <a
                key={item.id}
                href={item.href}
                {...(/^https?:\/\//.test(item.href) ? { target: "_blank", rel: "noopener noreferrer" } : {})}
              >
                {item.label}
                {/^https?:\/\//.test(item.href) && <ArrowUpRight aria-hidden="true" />}
              </a>
            ))}
            <button type="button" onClick={() => window.dispatchEvent(new CustomEvent(OPEN_COOKIE_SETTINGS_EVENT))}>
              Setări cookies
            </button>
          </nav>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
