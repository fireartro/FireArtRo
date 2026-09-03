import { CMS_DEFAULTS } from "@/data/cmsDefaults";
import { MessageCircle } from "lucide-react";
import { buildWhatsappLink } from "@/lib/constants";

import useManagedContent from "@/hooks/useManagedContent";

export const WhatsAppFloat = () => {
  const contactSettings = useManagedContent("contactSettings", CMS_DEFAULTS.contactSettings);
  const href = buildWhatsappLink(contactSettings.whatsappNumber);
  if (!href) return null;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      data-testid="whatsapp-float"
      aria-label="Contacteaza-ne pe WhatsApp"
      className="fixed bottom-6 left-6 z-40 h-14 w-14 rounded-full bg-[#25D366] flex items-center justify-center shadow-[0_8px_30px_rgba(37,211,102,0.4)] hover:scale-110 transition-transform duration-300"
    >
      <MessageCircle className="h-7 w-7 text-white" />
      <span className="absolute inset-0 rounded-full bg-[#25D366] animate-ping opacity-20" />
    </a>
  );
};

export default WhatsAppFloat;
