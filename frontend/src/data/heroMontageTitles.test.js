import films from './heroMontageTitles.json';
import { getHeroFilmCue } from '../components/site/heroFilmClock';

test('all three chapters have bounded, readable, non-overlapping Romanian captions', () => {
  expect(films).toHaveLength(3);
  for (const film of films) {
    expect(film.duration).toBe(30);
    expect(new Set(film.cues.map(cue => cue.id)).size).toBe(film.cues.length);
    for (let i = 0; i < film.cues.length; i += 1) {
      const cue = film.cues[i];
      expect(cue.start).toBeGreaterThanOrEqual(0);
      expect(cue.end).toBeLessThanOrEqual(30);
      expect(cue.end - cue.start).toBeGreaterThanOrEqual(2.5);
      if (i) expect(cue.start).toBeGreaterThanOrEqual(film.cues[i - 1].end);
      expect(cue.lines).toHaveLength(cue.motion === 'stack' ? 1 : 2);
    }
  }
});

test('the color caption accompanies daylight ignition and points accompany the drone formation', () => {
  expect(getHeroFilmCue(2, films[1]).id).toBe('color');
  expect(getHeroFilmCue(9, films[0]).id).toBe('points');
  expect(films[0].cues.some(cue => cue.id === 'color')).toBe(false);
  expect(getHeroFilmCue(24, films[2]).id).toBe('finale');
  expect(getHeroFilmCue(28, films[2])).toBeNull();
});

test('a seek selects captions from the media clock and leaves quiet gaps intact', () => {
  expect(getHeroFilmCue(10.95, films[0])).toBeNull();
  expect(getHeroFilmCue(32, films[1]).id).toBe('color');
  expect(getHeroFilmCue(2, films[1]).lines).toEqual(['CULOARE.']);
});

test('each chapter restores a five-row typography moment and leaves most footage clear', () => {
  for (const film of films) {
    expect(film.cues.filter(cue => cue.motion === 'stack')).toHaveLength(1);
    expect(film.cues.reduce((duration, cue) => duration + cue.end - cue.start, 0)).toBeLessThan(15);
  }
});
