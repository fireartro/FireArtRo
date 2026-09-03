import { CMS_DEFAULTS } from "@/data/cmsDefaults";
import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Expand } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import Navbar from "@/components/site/Navbar";
import PageEnd from "@/components/site/PageEnd";
import ScrollProgress from "@/components/site/ScrollProgress";
import usePageMeta from "@/hooks/usePageMeta";
import useManagedContent from "@/hooks/useManagedContent";

import "@/styles/night-gallery.css";
import ManagedPageMedia from "@/components/site/ManagedPageMedia";

const GALLERY_CATEGORIES = ["Artificii de zi", "Artificii de noapte", "Drone show"];

const getGalleryFrameRatio = (ratio) => {
  if (!Number.isFinite(ratio) || ratio <= 0) return 4 / 3;
  if (ratio < 0.6) return 3 / 4;
  if (ratio > 2) return 16 / 10;
  return ratio;
};

const interleaveByCategory = (items) => {
  const queues = GALLERY_CATEGORIES
    .map((category) => items.filter((item) => item.category === category))
    .filter((queue) => queue.length);
  const knownItems = new Set(queues.flat().map((item) => item.id));
  const customItems = items.filter((item) => !knownItems.has(item.id));
  if (customItems.length) queues.push(customItems);
  const mixedItems = [];

  while (queues.some((queue) => queue.length)) {
    queues.forEach((queue) => {
      const item = queue.shift();
      if (item) mixedItems.push(item);
    });
  }

  return mixedItems;
};

const gallerySchema = (items, siteUrl) => ({
  "@context": "https://schema.org",
  "@type": "CollectionPage",
  name: "Galerie FireArtRo",
  url: `${siteUrl}/galerie`,
  hasPart: items.map((item) => ({
    "@type": "ImageObject",
    name: item.title,
    description: item.shortDescription,
    contentUrl: new URL(item.src, siteUrl).toString(),
    thumbnailUrl: new URL(item.thumbnail || item.src, siteUrl).toString(),
  })),
});

export default function GalleryPage() {
  const copy = useManagedContent("galleryPage", CMS_DEFAULTS.galleryPage);
  const location = useLocation();
  const navigate = useNavigate();
  const media = useManagedContent("mediaItems", CMS_DEFAULTS.mediaItems);
  const siteDetails = useManagedContent("siteDetails", CMS_DEFAULTS.siteDetails);
  const photos = useMemo(
    () => [...media]
      .filter((item) => item.type === "image")
      .sort((a, b) => (a.order || 0) - (b.order || 0)),
    [media],
  );
  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const categories = useMemo(() => ["Toate", ...new Set([...GALLERY_CATEGORIES, ...photos.map((item) => item.category)])], [photos]);
  const requestedFilter = params.get("filtru") || "Toate";
  const activeFilter = categories.includes(requestedFilter) ? requestedFilter : "Toate";
  const visiblePhotos = useMemo(
    () => (activeFilter === "Toate"
      ? interleaveByCategory(photos)
      : photos.filter((item) => item.category === activeFilter)),
    [activeFilter, photos],
  );
  const [expandedIndex, setExpandedIndex] = useState(-1);
  const [imageRatios, setImageRatios] = useState({});
  const [previewFrame, setPreviewFrame] = useState(null);
  const expandedItem = visiblePhotos[expandedIndex];
  const previewRatio = expandedItem
    ? (imageRatios[expandedItem.id] || expandedItem.aspectRatio || 16 / 9)
    : 16 / 9;
  const schema = useMemo(
    () => gallerySchema(photos, siteDetails.siteUrl),
    [photos, siteDetails.siteUrl],
  );

  usePageMeta({
    title: copy.seoTitle,
    description: copy.seoDescription,
    path: "/galerie",
    schema,
  });

  const replaceQuery = useCallback((updates) => {
    const next = new URLSearchParams(location.search);
    Object.entries(updates).forEach(([key, value]) => {
      if (value) next.set(key, value);
      else next.delete(key);
    });
    const search = next.toString();
    navigate(`${location.pathname}${search ? `?${search}` : ""}`, { replace: true });
  }, [location.pathname, location.search, navigate]);

  useEffect(() => {
    const mediaId = params.get("media");
    if (!mediaId) {
      setExpandedIndex(-1);
      return;
    }

    const index = visiblePhotos.findIndex((item) => item.id === mediaId);
    setExpandedIndex(index);
  }, [params, visiblePhotos]);

  useLayoutEffect(() => {
    if (!expandedItem) {
      setPreviewFrame(null);
      return undefined;
    }

    const updatePreviewFrame = () => {
      const gutter = window.innerWidth <= 640 ? 8 : 16;
      const controlRail = window.innerWidth <= 640 ? 110 : 160;
      const maxWidth = window.innerWidth - gutter - controlRail;
      const maxHeight = window.innerHeight - (gutter * 2);
      const width = Math.min(maxWidth, maxHeight * previewRatio);

      setPreviewFrame({
        width: `${Math.floor(width)}px`,
      });
    };

    updatePreviewFrame();
    window.addEventListener("resize", updatePreviewFrame);
    return () => window.removeEventListener("resize", updatePreviewFrame);
  }, [expandedItem, previewRatio]);

  const selectFilter = (nextFilter) => {
    setExpandedIndex(-1);
    replaceQuery({ filtru: nextFilter === "Toate" ? null : nextFilter, media: null });
  };

  const rememberRatio = (itemId, event) => {
    const { naturalWidth, naturalHeight } = event.currentTarget;
    if (!naturalWidth || !naturalHeight) return;
    const ratio = naturalWidth / naturalHeight;
    setImageRatios((current) => {
      if (Math.abs((current[itemId] || 0) - ratio) < 0.01) return current;
      return { ...current, [itemId]: ratio };
    });
  };

  const openPhoto = (index) => {
    const item = visiblePhotos[index];
    if (!item) return;
    setExpandedIndex(index);
    replaceQuery({ media: item.id });
  };

  const closePhoto = () => {
    setExpandedIndex(-1);
    replaceQuery({ media: null });
  };

  const movePhoto = useCallback((direction) => {
    if (!visiblePhotos.length || expandedIndex < 0) return;
    const nextIndex = (expandedIndex + direction + visiblePhotos.length) % visiblePhotos.length;
    const nextItem = visiblePhotos[nextIndex];

    setExpandedIndex(nextIndex);
    replaceQuery({ media: nextItem.id });
  }, [expandedIndex, replaceQuery, visiblePhotos]);

  useEffect(() => {
    if (expandedIndex < 0) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === "ArrowLeft") movePhoto(-1);
      if (event.key === "ArrowRight") movePhoto(1);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [expandedIndex, movePhoto]);

  return (
    <main
      className="nr-gallery-page"
      data-design="night-runway"
      data-gallery-design="editorial-mosaic"
    >
      <ScrollProgress />
      <Navbar />

      <section className="nr-gallery-stage" data-testid="gallery-stage" aria-labelledby="gallery-title">
        <div className="nr-shell nr-gallery-stage__shell">
          <header className="nr-gallery-header">
            <div className="nr-gallery-header__title">
              <p>{copy.eyebrow}</p>
              <h1 id="gallery-title">{copy.title}</h1>
            </div>
            <p className="nr-gallery-header__intro">{copy.description}</p>
          </header>
          <ManagedPageMedia mediaId={copy.heroMediaId} />

          <nav className="nr-gallery-filters" data-testid="gallery-filters" aria-label="Filtre galerie">
            {categories.map((category) => {
              const count = category === "Toate"
                ? photos.length
                : photos.filter((item) => item.category === category).length;
              return (
                <button
                  key={category}
                  type="button"
                  aria-pressed={activeFilter === category}
                  className={activeFilter === category ? "is-active" : ""}
                  onClick={() => selectFilter(category)}
                >
                  <span>{category}</span>
                  <small>{count}</small>
                </button>
              );
            })}
          </nav>

          {visiblePhotos.length ? (
            <div className="nr-gallery-mosaic" data-testid="gallery-grid">
              {visiblePhotos.map((item, index) => (
                <article
                  key={item.id}
                  className="nr-gallery-card"
                  data-testid="gallery-card"
                  data-media-id={item.id}
                  data-category={item.category}
                  style={{
                    "--media-ratio": imageRatios[item.id] || item.aspectRatio || (item.featured ? 1.5 : 1.333),
                    "--gallery-frame-ratio": getGalleryFrameRatio(
                      imageRatios[item.id] || item.aspectRatio || (item.featured ? 1.5 : 1.333),
                    ),
                    "--gallery-index": index,
                  }}
                >
                  <button type="button" onClick={() => openPhoto(index)} aria-label={`Deschide ${item.title}`}>
                    <img
                      src={item.thumbnail || item.src}
                      alt={item.alt}
                      loading="eager"
                      decoding="async"
                      onLoad={(event) => rememberRatio(item.id, event)}
                    />
                    <span className="nr-gallery-card__expand" aria-hidden="true">
                      <Expand />
                    </span>
                  </button>
                </article>
              ))}
            </div>
          ) : (
            <div className="nr-gallery-empty" role="status">
              <p>Nu exista inca imagini in aceasta categorie.</p>
              <button type="button" onClick={() => selectFilter("Toate")}>Vezi toate imaginile</button>
            </div>
          )}
        </div>
      </section>

      <PageEnd />

      <Dialog open={expandedIndex >= 0} onOpenChange={(open) => !open && closePhoto()}>
        <DialogContent
          className="nr-gallery-lightbox"
          overlayClassName="nr-gallery-lightbox__overlay"
          aria-label={expandedItem ? `Previzualizare imagine: ${expandedItem.title}` : "Previzualizare imagine"}
          aria-describedby={undefined}
        >
          {expandedItem && (
            <div className="nr-gallery-lightbox__stage">
              <div
                className="nr-gallery-lightbox__frame"
                style={{ "--preview-ratio": previewRatio, ...previewFrame }}
              >
                <div className="nr-gallery-lightbox__layout">
                  <div className="nr-gallery-lightbox__media">
                    <img
                      src={expandedItem.src}
                      alt={expandedItem.alt}
                      loading="eager"
                      decoding="async"
                      onLoad={(event) => rememberRatio(expandedItem.id, event)}
                    />
                  </div>
                  <DialogTitle className="sr-only">{expandedItem.title}</DialogTitle>
                </div>
              </div>
              <button
                className="nr-gallery-lightbox__nav nr-gallery-lightbox__nav--previous"
                type="button"
                aria-label="Imaginea anterioară"
                onClick={() => movePhoto(-1)}
              >
                <ChevronLeft aria-hidden="true" />
              </button>
              <button
                className="nr-gallery-lightbox__nav nr-gallery-lightbox__nav--next"
                type="button"
                aria-label="Imaginea următoare"
                onClick={() => movePhoto(1)}
              >
                <ChevronRight aria-hidden="true" />
              </button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </main>
  );
}
