import { useMemo } from 'react';
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
// Source-size font units use the initial font, not the site's fluid CSS rem.
// Lazy auto sizing follows the rendered card; viewport fallbacks cover older browsers.
const GRID_IMAGE_SIZES = 'auto, (max-width: 599px) 100vw, (min-width: 1600px) and (min-height: 850px) 39vw, min(50vw, 551px)';
const FULL_WIDTH_IMAGE_SIZES = 'auto, (min-width: 1600px) and (min-height: 850px) 78vw, min(100vw, 1120px)';

export default function HomePackages() {
  const homePage = useManagedContent('homePage', CMS_DEFAULTS.homePage);
  const packages = useManagedContent('packages', CMS_DEFAULTS.packages);
  const mediaItems = useManagedContent('mediaItems', CMS_DEFAULTS.mediaItems);
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
  const copy = homePage.packages;

  return <section className="fa-packages fa-packages--grid" data-testid="home-packages" data-home-scene="packages" aria-labelledby="fa-packages-title">
    <div className="fa-packages__inner nr-shell">
      <header className="fa-packages__header">
        <p className="fa-kicker">{copy.eyebrow}</p><h2 id="fa-packages-title">{copy.title}</h2>
        {copy.description && <p>{copy.description}</p>}
      </header>
      <nav className="fa-packages__grid" aria-label="Game de spectacole">
        {scenes.map((scene, index) => <Link key={scene.category} to={scene.href} className="fa-packages__category"
          data-package-category={scene.category} aria-label={'Vezi ' + scene.label}>
          <img {...homeImageProps(scene.src)} sizes={scenes.length % 2 === 1 && index === scenes.length - 1 ? FULL_WIDTH_IMAGE_SIZES : GRID_IMAGE_SIZES} alt="" loading="lazy" decoding="async" />
          <div className="fa-packages__caption">
            <h3>{scene.label}</h3>
            <p>{scene.description}</p>
            <span className="fa-packages__discover"><span>Vezi mai multe opțiuni</span><ArrowUpRight aria-hidden="true" /></span>
          </div>
        </Link>)}
      </nav>
      {copy.ctaLabel && <Link className="fa-line-link fa-packages__all" to={copy.ctaHref}><span>{copy.ctaLabel}</span><ArrowUpRight aria-hidden="true" /></Link>}
    </div>
  </section>;
}
