import { CMS_DEFAULTS } from "@/data/cmsDefaults";
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Phone } from "lucide-react";
import {
  FacebookIcon,
  InstagramIcon,
  WhatsAppIcon,
  YouTubeIcon,
} from "@/components/site/BrandIcons";
import { useIsMobile } from "@/hooks/useMediaQuery";
import useManagedContent from "@/hooks/useManagedContent";

import { buildWhatsappLink } from "@/lib/constants";

const EASE = [0.22, 1, 0.36, 1];

const DockButton = ({ item, mobile = false }) => {
  const { label, href, Icon, color, external } = item;
  return (
    <a
      href={href}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      aria-label={label}
      title={label}
      className="social-dock-link"
      style={{ "--social-color": color }}
    >
      <Icon className={mobile ? "social-dock-icon-mobile" : "social-dock-icon"} />
      {!mobile && <span>{label}</span>}
    </a>
  );
};

const DesktopDock = ({ items }) => (
  <motion.aside
    initial={{ opacity: 0, x: 28 }}
    animate={{ opacity: 1, x: 0 }}
    exit={{ opacity: 0, x: 20 }}
    transition={{ duration: 0.6, delay: 0.35, ease: EASE }}
    className="desktop-social-dock"
    data-testid="social-dock"
    aria-label="Rețele sociale și contact"
  >
    {items.map((item) => <DockButton key={item.key} item={item} />)}
  </motion.aside>
);

const MobileDock = ({ items }) => (
  <motion.aside
    initial={{ opacity: 0, y: 18 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: 18 }}
    transition={{ duration: 0.45, ease: EASE }}
    className="mobile-social-dock"
    data-testid="social-dock"
    aria-label="Rețele sociale și contact"
  >
    {items.map((item) => <DockButton key={item.key} item={item} mobile />)}
  </motion.aside>
);

export const SocialDock = () => {
  const mobile = useIsMobile();
  const [visible, setVisible] = useState(true);
  const socialLinks = useManagedContent("socialLinks", CMS_DEFAULTS.socialLinks);
  const contactSettings = useManagedContent("contactSettings", CMS_DEFAULTS.contactSettings);
  const items = useMemo(() => {
    const socialMap = Object.fromEntries(socialLinks.map((item) => [item.id, item.href]));
    const whatsappHref = buildWhatsappLink(contactSettings.whatsappNumber);
    const phoneHref = contactSettings.phoneTel || contactSettings.phoneDisplay?.replace(/\s/g, "");
    return [
      { key: "youtube", label: "YouTube", href: socialMap.youtube, Icon: YouTubeIcon, color: "#ff1744", external: true },
      { key: "facebook", label: "Facebook", href: socialMap.facebook, Icon: FacebookIcon, color: "#1877f2", external: true },
      { key: "instagram", label: "Instagram", href: socialMap.instagram, Icon: InstagramIcon, color: "#e1306c", external: true },
      { key: "whatsapp", label: "WhatsApp", href: whatsappHref || "/contact", Icon: WhatsAppIcon, color: "#25d366", external: Boolean(whatsappHref) },
      { key: "phone", label: "Telefon", href: phoneHref ? `tel:${phoneHref}` : "/contact", Icon: Phone, color: "#5cb7ff", external: false },
    ].filter((item) => item.href);
  }, [contactSettings, socialLinks]);

  useEffect(() => {
    const hero = document.getElementById("acasa");
    if (!hero) return;
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { threshold: 0.08 },
    );
    observer.observe(hero);
    return () => observer.disconnect();
  }, []);

  return (
    <AnimatePresence>
      {visible && (mobile ? <MobileDock key="mobile" items={items} /> : <DesktopDock key="desktop" items={items} />)}
    </AnimatePresence>
  );
};

export default SocialDock;
