import {
  buildCategoryRanges,
  collectPackageVideos,
  getCategoryLabel,
  getCategoryPhoto,
  isGalleryVisible,
  resolveCategory,
} from "./categoryNavigation";

const packages = [
  { id: "effects", category: "Efecte speciale", title: "Mix", imageMediaId: "effects-photo" },
  { id: "day", category: "Artificii de zi", title: "Multicolor", imageMediaId: "day-photo" },
  { id: "night", category: "Artificii de noapte", title: "Gold", imageMediaId: "night-photo" },
  { id: "festival", category: "Corporate / Festival", title: "Festival" },
];

test("orders available ranges night, day, drones, effects, then remaining CMS categories", () => {
  const ranges = buildCategoryRanges(packages, { includeDroneRequest: true });

  expect(ranges.map((range) => range.category)).toEqual([
    "Artificii de noapte",
    "Artificii de zi",
    "Show drone",
    "Efecte speciale",
    "Corporate / Festival",
  ]);
  expect(ranges[0]).toMatchObject({ count: 1, firstPackageId: "night", imageMediaId: "night-photo" });
});

test("uses the requested existing category and falls back to the first available range", () => {
  const categories = ["Artificii de noapte", "Artificii de zi", "Efecte speciale"];

  expect(resolveCategory("Artificii de zi", categories)).toBe("Artificii de zi");
  expect(resolveCategory("Categorie inexistentă", categories)).toBe("Artificii de noapte");
});

test("collects the primary and every additional video once while ignoring blanks", () => {
  expect(collectPackageVideos({
    videoUrl: " https://youtu.be/primary ",
    moreVideoUrls: ["https://youtu.be/extra", "https://youtu.be/primary", "", " https://youtu.be/extra-2 "],
  })).toEqual([
    "https://youtu.be/primary",
    "https://youtu.be/extra",
    "https://youtu.be/extra-2",
  ]);
});

test("returns an empty video list for incomplete CMS package data", () => {
  expect(collectPackageVideos({ moreVideoUrls: null })).toEqual([]);
  expect(collectPackageVideos(null)).toEqual([]);
});

test("keeps internal drone category values while exposing the approved public label", () => {
  expect(getCategoryLabel("Show drone")).toBe("Spectacole de drone");
  expect(getCategoryLabel("Drone show")).toBe("Spectacole de drone");
  expect(getCategoryLabel("Artificii de noapte")).toBe("Artificii de noapte");
});

test("excludes only media explicitly tagged as hidden from the gallery", () => {
  expect(isGalleryVisible({ tags: ["Drone", "ascuns-din-galerie"] })).toBe(false);
  expect(isGalleryVisible({ tags: ["Drone"] })).toBe(true);
  expect(isGalleryVisible({})).toBe(true);
});

test("uses real curated drone photography and skips a hidden preferred photo", () => {
  const preferred = { id: "gallery-import-drone-021", type: "image", category: "Drone show", src: "/real-drone.webp", tags: [] };
  const another = { id: "other", type: "image", category: "Drone show", src: "/another-drone.webp", tags: [] };
  expect(getCategoryPhoto("Show drone", new Map([[preferred.id, preferred], [another.id, another]]))).toBe("/real-drone.webp");
  expect(getCategoryPhoto("Show drone", new Map([[preferred.id, {...preferred, tags: ["ascuns-din-galerie"]}], [another.id, another]]))).toBe("/another-drone.webp");
});
