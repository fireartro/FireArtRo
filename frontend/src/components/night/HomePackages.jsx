import { useMemo, useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { CMS_DEFAULTS } from '@/data/cmsDefaults';
import catalogue from '@/data/importedGalleryItems.json';
import useManagedContent from '@/hooks/useManagedContent';
import { MEDIA } from '@/data/content';
import { buildCategoryRanges, getCategoryLabel, getCategoryPhoto, isGalleryVisible } from '@/lib/categoryNavigation';
import { homeImageProps } from '@/lib/homeImage';
import '@/styles/home-package-selector.css';
import { HOME_PACKAGE_IMAGE_IDS } from '@/lib/homeMediaSelection';
export { HOME_PACKAGE_IMAGE_IDS } from '@/lib/homeMediaSelection';

const originals = new Map(catalogue.map(item => [item.id, item]));

export default function HomePackages() {
  const homePage = useManagedContent('homePage', CMS_DEFAULTS.homePage);
  const packages = useManagedContent('packages', CMS_DEFAULTS.packages);
  const mediaItems = useManagedContent('mediaItems', CMS_DEFAULTS.mediaItems);
  const [selected, setSelected] = useState('');
  const scenes = useMemo(() => {
    const byId = new Map(mediaItems.map(item => [item.id, item]));
    return buildCategoryRanges(packages, { includeDroneRequest: true }).map(range => {
      const recommendedId = HOME_PACKAGE_IMAGE_IDS[range.category];
      const recommended = byId.get(recommendedId) || originals.get(recommendedId);
      const configured = byId.get(range.imageMediaId);
      const image = recommended && isGalleryVisible(recommended) ? recommended : configured && isGalleryVisible(configured) ? configured : null;
      return { ...range, label: getCategoryLabel(range.category), href: '/pachete?categorie=' + encodeURIComponent(range.category),
        src: image?.src || getCategoryPhoto(range.category, byId) || MEDIA.fireworksSky };
    });
  }, [packages, mediaItems]);
  const active = scenes.find(scene => scene.category === selected) || scenes[0];
  const copy = homePage.packages;
  const picture = scene => <img {...homeImageProps(scene.src)} sizes="(max-width: 899px) 100vw, 62vw" alt="" loading="lazy" decoding="async" />;
  const caption = scene => <span className="fa-packages__scene-caption"><span>{scene.description}</span><span className="fa-packages__discover">Vezi mai multe opțiuni <ArrowUpRight aria-hidden="true" /></span></span>;

  return <section className="fa-packages fa-packages--selector" data-testid="home-packages" data-home-scene="packages" aria-labelledby="fa-packages-title">
    <div className="fa-packages__inner nr-shell">
      <header className="fa-packages__header">
        <p className="fa-kicker">{copy.eyebrow}</p><h2 id="fa-packages-title">{copy.title}</h2>
        {copy.description && <p>{copy.description}</p>}
      </header>
      {active && <div className="fa-packages__selector">
        <nav className="fa-packages__categories" aria-label="Game de spectacole">
          {scenes.map(scene => <Link key={scene.category} to={scene.href} className="fa-packages__category" data-package-category={scene.category}
            data-active={scene === active} onMouseEnter={() => setSelected(scene.category)} onFocus={() => setSelected(scene.category)}>
            <h3>{scene.label}</h3><ArrowUpRight aria-hidden="true" /><span>Vezi mai multe opțiuni</span>
          </Link>)}
        </nav>
        <Link key={active.src} to={active.href} className="fa-packages__scene" aria-label={'Vezi ' + active.label}>
          {picture(active)}{caption(active)}
        </Link>
      </div>}
      <div className="fa-packages__mobile-scenes">
        {scenes.map(scene => <Link key={scene.category} className="fa-packages__mobile-scene" to={scene.href} aria-label={'Vezi ' + scene.label}>
          {picture(scene)}<span className="fa-packages__mobile-caption"><h3>{scene.label}</h3>{caption(scene)}</span>
        </Link>)}
      </div>
      {copy.ctaLabel && <Link className="fa-line-link fa-packages__all" to={copy.ctaHref}><span>{copy.ctaLabel}</span><ArrowUpRight aria-hidden="true" /></Link>}
    </div>
  </section>;
}
