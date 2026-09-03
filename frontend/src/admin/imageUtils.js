const MAX_SOURCE_BYTES = 6 * 1024 * 1024;
const MAX_EDGE = 1800;
const MAX_DATA_URL_LENGTH = 2_400_000;
const WEBP_QUALITIES = [0.82, 0.72, 0.62];

const readAsDataUrl = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result));
  reader.onerror = () => reject(new Error("Imaginea nu a putut fi citita."));
  reader.readAsDataURL(file);
});

const loadImage = (src) => new Promise((resolve, reject) => {
  const image = new Image();
  image.onload = () => resolve(image);
  image.onerror = () => reject(new Error("Formatul imaginii nu poate fi procesat."));
  image.src = src;
});

const exportWebp = (canvas) => {
  for (const quality of WEBP_QUALITIES) {
    const dataUrl = canvas.toDataURL("image/webp", quality);
    if (dataUrl.length <= MAX_DATA_URL_LENGTH) return dataUrl;
  }
  throw new Error("Imaginea optimizata este prea mare pentru salvarea locala. Alege un cadru mai mic.");
};

export async function prepareAdminImage(file) {
  if (!file?.type?.startsWith("image/")) {
    throw new Error("Selecteaza un fisier imagine JPG, PNG, WebP sau AVIF.");
  }
  if (file.size > MAX_SOURCE_BYTES) {
    throw new Error("Imaginea depaseste 6 MB. Redu dimensiunea si incearca din nou.");
  }

  const source = await readAsDataUrl(file);
  const image = await loadImage(source);
  const scale = Math.min(1, MAX_EDGE / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { alpha: true });
  if (!context) throw new Error("Browserul nu poate optimiza imaginea.");
  context.drawImage(image, 0, 0, width, height);

  return {
    dataUrl: exportWebp(canvas),
    width,
    height,
    originalName: file.name,
  };
}
