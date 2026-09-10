// One-time, explicit owner revision; never applied over live Admin publications.
export function applyOwnerRevision(content, revision) {
  const next = JSON.parse(JSON.stringify(content));
  Object.entries(revision.copy).forEach(([path, value]) => {
    const keys = path.split('.');
    const field = keys.pop();
    const parent = keys.reduce((node, key) => node?.[key], next);
    if (parent) parent[field] = value;
  });
  const hidden = new Set(revision.hiddenMediaIds);
  next.mediaItems = next.mediaItems.map(item => hidden.has(item.id)
    ? { ...item, tags: [...new Set([...item.tags, 'ascuns-din-galerie'])] }
    : item);
  const mediaById = new Map(next.mediaItems.map(item => [item.id, item]));
  next.packages = next.packages.map(item => {
    const imageId = revision.categoryImageIds[item.category];
    return mediaById.has(imageId) && (!item.imageMediaId || hidden.has(item.imageMediaId))
      ? { ...item, imageMediaId: imageId } : item;
  });
  next.faqs = next.faqs.map(item => revision.faqAnswers[item.id]
    ? { ...item, a: revision.faqAnswers[item.id] } : item);
  const slideOrder = ['Artificii de noapte', 'Artificii de zi', 'Drone show'];
  next.homePage.promoSlides = next.homePage.promoSlides.map(slide => {
    if (slide.type !== 'image') return slide;
    const current = mediaById.get(slide.mediaId);
    const category = current?.category;
    const imageId = revision.categoryImageIds[category === 'Drone show' ? 'Show drone' : category];
    const media = mediaById.get(imageId);
    return media ? { ...slide, mediaId: imageId, title: category === 'Drone show' ? 'Spectacole de drone' : category,
      badge: category, shortText: media.alt, ctaHref: `/galerie?filtru=${encodeURIComponent(category)}` } : slide;
  }).sort((a, b) => {
    const rank = slide => { const index = slideOrder.indexOf(mediaById.get(slide.mediaId)?.category); return index < 0 ? 99 : index; };
    return rank(a) - rank(b);
  });
  return next;
}
