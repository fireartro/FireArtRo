import { useMemo, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { Link } from "react-router-dom";
import { CMS_DEFAULTS } from "@/data/cmsDefaults";
import { isOriginalPartnerSeed, PARTNER_GROUPS, resolveDisplayPartners } from "@/data/partnerCatalog";
import useManagedContent from "@/hooks/useManagedContent";
import useNearViewport from "@/hooks/useNearViewport";
import "@/styles/night-partners.css";

function PartnerMark({ src, theme }) {
  const [failedSource, setFailedSource] = useState(null);
  if (!src || failedSource === src) return null;
  return <div className="fa-partner__mark" data-theme={theme || "light"}>
    <img src={src} alt="" width="200" height="96" loading="lazy" decoding="async" onError={() => setFailedSource(src)} />
  </div>;
}

function PartnerFirework() {
  return <svg className="fa-partners-gallery__firework" viewBox="0 0 240 180" fill="none" aria-hidden="true">
    {Array.from({ length: 16 }, (_, index) => <g key={index} transform={`rotate(${index * 22.5} 120 88)`}>
      <path d="M120 66 Q114 42 120 13" />
      <path className="fa-partners-gallery__spark" d="M120 8v-3" />
      <circle cx="120" cy="32" r={index % 3 === 0 ? "1.5" : "0.8"} />
    </g>)}
    <circle cx="120" cy="88" r="3" />
    <path className="fa-partners-gallery__horizon" d="M14 169h212M70 174h100" />
  </svg>;
}

function PartnerGroup({ group, items, reduceMotion }) {
  const ref = useRef(null);
  const entered = useNearViewport(ref, "-8% 0px");
  return <div ref={ref} className="fa-partners-gallery__group" data-entered={reduceMotion || entered ? "true" : "waiting"}>
    <div className="fa-partners-gallery__category"><h3>{group.title}</h3><span aria-hidden="true" /></div>
    <ul className="fa-partners-gallery__grid" aria-label={group.title}>
      {items.map((partner, index) => <li className="fa-partner" data-partner-id={partner.id} key={partner.id} style={{ "--partner-delay": `${(index % 5) * 55}ms` }}>
        <div className="fa-partner__body">
          {partner.logo ? <PartnerMark src={partner.logo} theme={partner.theme} /> : <span className="fa-partner__wordmark" data-partner-name>{partner.name}</span>}
        </div>
        {partner.logo && <span className="fa-partner__name" data-partner-name>{partner.name}</span>}
      </li>)}
    </ul>
  </div>;
}

export default function HomePartners() {
  const homePage = useManagedContent("homePage", CMS_DEFAULTS.homePage);
  const managedPartners = useManagedContent("partners", CMS_DEFAULTS.partners);
  const mediaItems = useManagedContent("mediaItems", CMS_DEFAULTS.mediaItems);
  const reduceMotion = useReducedMotion();
  const partners = useMemo(() => resolveDisplayPartners(managedPartners, mediaItems), [managedPartners, mediaItems]);
  const copy = homePage.partners;
  const untouchedSeed = isOriginalPartnerSeed(managedPartners);
  const defaultCopy = CMS_DEFAULTS.homePage.partners;
  const title = untouchedSeed && copy.title === defaultCopy.title ? "Împreună, dincolo de spectacol." : copy.title;
  // Preserve exact Admin ordering when the owner publishes a custom list.
  const groups = untouchedSeed ? PARTNER_GROUPS : [{ id: "custom", title: "Parteneri & colaboratori" }];
  if (!partners.length) return null;

  return <section className="fa-partners fa-partners-gallery" id="parteneri" data-home-scene="partners" data-testid="home-partners" data-motion={reduceMotion ? "reduced" : "subtle"} aria-labelledby="fa-partners-title">
    <div className="nr-shell fa-partners-gallery__inner">
      <header className="fa-partners-gallery__header">
        <div>
          <p className="fa-kicker">{copy.eyebrow}</p>
          <h2 id="fa-partners-title">{title}</h2>
          {copy.ctaLabel && <Link className="fa-line-link" to={copy.ctaHref}>{copy.ctaLabel}</Link>}
        </div>
        <div className="fa-partners-gallery__signature"><PartnerFirework /><span>Parteneri & colaboratori</span></div>
      </header>
      <div className="fa-partners-gallery__groups">
        {groups.map(group => {
          const items = group.id === "custom" ? partners : partners.filter(partner => partner.group === group.id);
          if (!items.length) return null;
          return <PartnerGroup key={group.id} group={group} items={items} reduceMotion={reduceMotion} />;
        })}
      </div>
    </div>
  </section>;
}
