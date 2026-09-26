import { getNextFilmIndex, selectMontageFormat, shouldPreloadNextFilm } from './heroMontagePlayback';

test('selects a single composition for the actual viewport orientation', () => {
  expect(selectMontageFormat(1920, 1080)).toBe('wide');
  expect(selectMontageFormat(1024, 768)).toBe('wide');
  expect(selectMontageFormat(768, 1024)).toBe('portrait');
  expect(selectMontageFormat(390, 844)).toBe('portrait');
});

test('preloads the next film in its final five seconds only while visible', () => {
  expect(shouldPreloadNextFilm(24.9, 30, true)).toBe(false);
  expect(shouldPreloadNextFilm(25, 30, true)).toBe(true);
  expect(shouldPreloadNextFilm(29.8, 30, true)).toBe(true);
  expect(shouldPreloadNextFilm(26, 30, false)).toBe(false);
});

test('loops between all three chapters without repeating the first too soon', () => {
  expect([0, 1, 2, 0].map(index => getNextFilmIndex(index, 3))).toEqual([1, 2, 0, 1]);
});
