export const selectMontageFormat = (width, height) => width <= height ? 'portrait' : 'wide';

export const getNextFilmIndex = (index, count = 3) => (index + 1) % count;

export const shouldPreloadNextFilm = (currentTime, duration = 30, visible = true) => (
  visible && Number.isFinite(currentTime) && currentTime >= Math.max(0, duration - 5)
);
