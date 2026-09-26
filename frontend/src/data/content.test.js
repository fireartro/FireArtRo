import { MEDIA } from './content';

test('uses documented FireArtRo gallery photographs instead of generated drone imagery', () => {
  for (const key of ['droneShow', 'droneShow2', 'droneShow3']) {
    expect(MEDIA[key]).toMatch(/^\/media\/gallery\/fireartro-drone-show-/);
    expect(MEDIA[key]).not.toMatch(/\/media\/drone-show(?:-2|-3)?\.webp$/);
  }
});
