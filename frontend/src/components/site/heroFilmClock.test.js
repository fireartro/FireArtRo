import { getHeroFilmCue, getHeroCuePose, getHeroEchoPose } from './heroFilmClock';

test('selects the cue at the video time and clears text between cues', () => {
  expect(getHeroFilmCue(0.1)).toBeNull();
  expect(getHeroFilmCue(1)?.id).toBe('lift');
  expect(getHeroFilmCue(2.7)).toBeNull();
  expect(getHeroFilmCue(8)?.id).toBe('color');
});

test('retains the hosted-film five-row stack after the entrance has settled', () => {
  const cue = { start: 2, end: 5, motion: 'stack' };
  expect(getHeroEchoPose(cue, 3, -2)).toMatchObject({opacity: .55, y: -172});
  expect(getHeroEchoPose(cue, 3, -1)).toMatchObject({opacity: .85, y: -86});
  expect(getHeroEchoPose(cue, 3, 1)).toMatchObject({opacity: .85, y: 86});
  expect(getHeroEchoPose(cue, 3, 2)).toMatchObject({opacity: .55, y: 172});
  expect(getHeroEchoPose(cue, 5, 1).opacity).toBe(0);
  expect(getHeroEchoPose(cue, 1, 1).opacity).toBe(0);
});

test('uses visibly different punch, lateral and cascade entrances', () => {
  expect(getHeroCuePose({start:2,end:5,motion:'punch'},2.05).scale).toBeGreaterThan(1);
  expect(Math.abs(getHeroCuePose({start:2,end:5,motion:'slide'},2.05).x)).toBeGreaterThan(5);
  expect(getHeroCuePose({start:2,end:5,motion:'rise'},2.05).y).toBeGreaterThan(5);
});

test('resynchronizes after a loop and rejects invalid clock values', () => {
  expect(getHeroFilmCue(33)?.id).toBe('lift');
  expect(getHeroFilmCue(32)).toBeNull();
  expect(getHeroFilmCue(NaN)).toBeNull();
  expect(getHeroFilmCue(Infinity)).toBeNull();
  expect(getHeroFilmCue(-1)).toBeNull();
});

test('word entrance, hold and exit are deterministic on backwards seeks', () => {
  const cue = { start: 2, end: 5 };
  expect(getHeroCuePose(cue, 1, 0).opacity).toBe(0);
  expect(getHeroCuePose(cue, 3, 0)).toMatchObject({opacity: 1, x: 0, y: 0});
  expect(getHeroCuePose(cue, 5, 0).opacity).toBe(0);
  expect(getHeroCuePose(cue, 2.1, 1).opacity).toBe(0);
  expect(getHeroCuePose(cue, 3, 0)).toMatchObject({opacity: 1, x: 0, y: 0});
});
