import revision from "@/data/ownerRevision.json";

export const DRONE_REQUEST_CATEGORY = "Show drone";

export const getCategoryPhoto = (category, mediaById) => {
  const preferred = mediaById.get(revision.categoryImageIds[category]);
  if (preferred && isGalleryVisible(preferred)) return preferred.src;
  const mediaCategory = category === DRONE_REQUEST_CATEGORY ? "Drone show" : category;
  return [...mediaById.values()].find(item => item.type === "image" && item.category === mediaCategory && isGalleryVisible(item))?.src;
};

const CATEGORY_PRIORITY = [
  "Artificii de noapte",
  "Artificii de zi",
  DRONE_REQUEST_CATEGORY,
  "Drone + artificii",
  "Efecte speciale",
];

const CATEGORY_COPY = {
  "Artificii de noapte": "Spectacole pirotehnice construite pentru ritmul și amploarea serii.",
  "Artificii de zi": "Culoare și efecte cu impact vizibil în lumină naturală.",
  "Show drone": "Coregrafii luminoase personalizate, dezvoltate după brief.",
  "Drone + artificii": "Coregrafie aeriană și pirotehnie într-un singur punct culminant.",
  "Efecte speciale": "Efecte scenice pentru intrare, dans, tort și momente live.",
};

const CATEGORY_LABELS = {
  "Show drone": "Spectacole de drone",
  "Drone show": "Spectacole de drone",
};

const categoryRank = (category) => {
  const rank = CATEGORY_PRIORITY.indexOf(category);
  return rank === -1 ? CATEGORY_PRIORITY.length : rank;
};

export const buildCategoryRanges = (packages = [], { includeDroneRequest = false } = {}) => {
  const safePackages = Array.isArray(packages) ? packages.filter(Boolean) : [];
  const categories = [];

  safePackages.forEach((item) => {
    if (item.category && !categories.includes(item.category)) categories.push(item.category);
  });
  if (includeDroneRequest && !categories.includes(DRONE_REQUEST_CATEGORY)) {
    categories.push(DRONE_REQUEST_CATEGORY);
  }

  return categories
    .map((category, sourceIndex) => ({ category, sourceIndex }))
    .sort((a, b) => categoryRank(a.category) - categoryRank(b.category) || a.sourceIndex - b.sourceIndex)
    .map(({ category }) => {
      const items = safePackages.filter((item) => item.category === category);
      const imagePackage = items.find((item) => item.imageMediaId) || items[0];
      return {
        category,
        description: CATEGORY_COPY[category] || items[0]?.shortDescription || "Descoperă opțiunile disponibile pentru evenimentul tău.",
        count: items.length,
        firstPackageId: items[0]?.id || "",
        imageMediaId: imagePackage?.imageMediaId || "",
      };
    });
};

export const resolveCategory = (requestedCategory, categories = []) => (
  categories.includes(requestedCategory) ? requestedCategory : (categories[0] || "")
);

export const collectPackageVideos = (item) => {
  if (!item) return [];
  const values = [
    item.videoUrl,
    ...(Array.isArray(item.moreVideoUrls) ? item.moreVideoUrls : []),
  ];
  return [...new Set(values.map((value) => value?.trim()).filter(Boolean))];
};

export const getCategoryLabel = (category) => CATEGORY_LABELS[category] || category;

export const isGalleryVisible = (item) => !(
  Array.isArray(item?.tags) && item.tags.includes("ascuns-din-galerie")
);
