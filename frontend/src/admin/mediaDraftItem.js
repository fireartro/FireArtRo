const DEFAULT_CATEGORY = 'Artificii de noapte';

export function createDraftMediaItem(item, {
  title = '', alt = '', category = DEFAULT_CATEGORY, order = 1,
  date = new Date().toISOString().slice(0, 10),
} = {}) {
  const isImage = item.content_type.startsWith('image/');
  const itemTitle = String(title).trim() || item.filename;
  const itemAlt = String(alt).trim() || item.alt_text || itemTitle;
  const hasDimensions = Number.isFinite(item.width) && item.width > 0
    && Number.isFinite(item.height) && item.height > 0;

  return {
    id: item.id,
    type: isImage ? 'image' : 'video',
    title: itemTitle,
    shortDescription: itemAlt,
    category,
    tags: [],
    thumbnail: isImage ? item.url : '',
    poster: '',
    src: item.url,
    youtubeUrl: '',
    alt: itemAlt,
    featured: false,
    date,
    order,
    eventType: '',
    ctaLabel: '',
    ctaHref: '',
    width: hasDimensions ? item.width : null,
    height: hasDimensions ? item.height : null,
    aspectRatio: hasDimensions ? item.width / item.height : null,
  };
}
