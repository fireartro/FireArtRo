import films from './heroMontageTitles.json';
import { getHeroFilmCue } from '../components/site/heroFilmClock';
import { selectHeroMontageTitles } from './heroMontageTitles';

test('all three chapters have bounded, readable, non-overlapping Romanian captions', () => {
  expect(films).toHaveLength(3);
  for (const film of films) {
    expect(film.duration).toBe(40);
    expect(new Set(film.cues.map(cue => cue.id)).size).toBe(film.cues.length);
    for (let i = 0; i < film.cues.length; i += 1) {
      const cue = film.cues[i];
      expect(cue.start).toBeGreaterThanOrEqual(0);
      expect(cue.end).toBeLessThanOrEqual(film.duration);
      expect(cue.end - cue.start).toBeGreaterThanOrEqual(2.5);
      if (i) expect(cue.start).toBeGreaterThanOrEqual(film.cues[i - 1].end);
      expect(cue.lines).toHaveLength(cue.motion === 'stack' ? 1 : 2);
    }
  }
});

test('the color caption accompanies daylight ignition and points accompany the drone formation', () => {
  expect(getHeroFilmCue(3, films[1]).id).toBe('color');
  expect(getHeroFilmCue(19.5, films[0]).id).toBe('points');
  expect(films[0].cues.some(cue => cue.id === 'color')).toBe(false);
  expect(getHeroFilmCue(33.5, films[2]).id).toBe('finale');
  expect(getHeroFilmCue(28, films[2])).toBeNull();
});

test('a seek selects captions from the media clock and leaves quiet gaps intact', () => {
  expect(getHeroFilmCue(12.1, films[0])).toBeNull();
  expect(getHeroFilmCue(43, films[1]).id).toBe('color');
  expect(getHeroFilmCue(3, films[1]).lines).toEqual(['CULOARE.']);
});

test('each chapter restores a five-row typography moment and leaves most footage clear', () => {
  for (const film of films) {
    expect(film.cues.filter(cue => cue.motion === 'stack')).toHaveLength(1);
    expect(film.cues.reduce((duration, cue) => duration + cue.end - cue.start, 0)).toBeLessThan(15);
  }
});

test('orientation-specific captions stay ordered and follow the changed daytime and drone cuts', () => {
  for (const format of ['wide', 'portrait']) {
    for (let index = 0; index < 3; index += 1) {
      const film = selectHeroMontageTitles(index, format);
      expect(selectHeroMontageTitles(index, format)).toBe(film);
      film.cues.forEach((cue, i) => {
        expect(cue.end).toBeLessThanOrEqual(film.duration);
        expect(cue.end - cue.start).toBeGreaterThanOrEqual(2.5);
        if (i) expect(cue.start).toBeGreaterThanOrEqual(film.cues[i - 1].end);
      });
    }
  }
  expect(getHeroFilmCue(14, selectHeroMontageTitles(1, 'wide')).id).toBe('color');
  expect(getHeroFilmCue(2, selectHeroMontageTitles(1, 'portrait')).id).toBe('color');
  expect(getHeroFilmCue(6, selectHeroMontageTitles(2, 'wide')).id).toBe('combined');
  expect(getHeroFilmCue(13.5, selectHeroMontageTitles(2, 'portrait')).id).toBe('combined');
});
