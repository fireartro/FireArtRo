import { CMS_DEFAULTS } from "@/data/cmsDefaults";
import NightButton from "@/components/night/NightButton";
import SectionSignal from "@/components/night/SectionSignal";
import MediaFrame from "@/components/night/MediaFrame";

import { MEDIA } from "@/data/content";
import useManagedContent from "@/hooks/useManagedContent";
import { buildWhatsappLink } from "@/lib/constants";
import { goToContact } from "@/lib/contactNavigation";
import "@/styles/night-footer.css";

export const FinalCta = () => {
  const contactSettings = useManagedContent("contactSettings", CMS_DEFAULTS.contactSettings);
  const whatsAppHref = buildWhatsappLink(contactSettings.whatsappNumber);

  return (
    <section
      className="nr-final-cta"
      data-testid="night-final-cta"
      aria-labelledby="night-final-cta-title"
    >
      <MediaFrame
        className="nr-final-cta__media"
        data-testid="night-final-cta-media"
        src={MEDIA.crowd3}
        alt="Public privind un spectacol de artificii pe cerul nopții"
      >
        <span className="nr-final-cta__media-flare" aria-hidden="true" />
      </MediaFrame>

      <span className="nr-final-cta__veil" aria-hidden="true" />

      <div className="nr-final-cta__shell nr-shell">
        <div className="nr-final-cta__copy">
          <SectionSignal
            index="07"
            eyebrow="Coordonate de lansare"
            title="Următorul moment începe cu un brief clar."
            description="Trimite-ne data, locația și tipul evenimentului. Revenim cu întrebările care transformă ideea într-o direcție de spectacol."
            id="night-final-cta-title"
          />

          <div className="nr-final-cta__coordinates" aria-label="Informații utile pentru prima discuție">
            <span>Data</span>
            <span>Locația</span>
            <span>Tipul evenimentului</span>
          </div>

          <div className="nr-final-cta__actions">
            <NightButton
              as="button"
              variant="primary"
              onClick={() => goToContact()}
              data-testid="final-cta-primary"
            >
              Planifică spectacolul
            </NightButton>

            {whatsAppHref && (
              <NightButton
                href={whatsAppHref}
                variant="secondary"
                target="_blank"
                rel="noopener noreferrer"
                data-testid="final-cta-whatsapp"
              >
                Continuă pe WhatsApp
              </NightButton>
            )}
          </div>
        </div>
      </div>

      <span
        className="nr-final-cta__horizon"
        data-testid="night-final-cta-horizon"
        aria-hidden="true"
      />
    </section>
  );
};

export default FinalCta;
