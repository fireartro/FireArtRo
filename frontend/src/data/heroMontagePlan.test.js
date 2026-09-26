import plan from './heroMontagePlan.json';

const scenes = format => plan.episodes[format].flat();

test('each orientation has three 30-second films with one scene per frame', () => {
  for (const format of ['wide', 'portrait']) {
    expect(plan.episodes[format]).toHaveLength(3);
    for (const episode of plan.episodes[format]) {
      expect(episode.reduce((sum, scene) => sum + scene.duration, 0)).toBeCloseTo(30, 6);
      for (const scene of episode) {
        expect(['video', 'drone']).toContain(scene.type);
        expect(scene.sources).toBeUndefined();
        if (scene.image) expect(scene.image).toMatch(/^\/media\/gallery\/fireartro-drone-show-/);
      }
    }
  }
});

test('desktop uses only native landscape originals, never portrait footage or panels', () => {
  for (const scene of scenes('wide').filter(scene => scene.type === 'video')) {
    expect([0, 1, 18, 19, 20, 21, 22]).toContain(scene.source);
    expect(scene.focus).toBeUndefined();
  }
});

test('no scene repeats within the 90-second cycle, including alternate slow-motion edits', () => {
  for (const format of ['wide', 'portrait']) {
    const videos = scenes(format).filter(scene => scene.type === 'video');
    expect(videos.some(scene => [6, 8, 15].includes(scene.source))).toBe(false);
    videos.forEach((scene, index) => {
      for (const other of videos.slice(index + 1).filter(other => other.source === scene.source)) {
        expect(Math.min(scene.start + scene.duration, other.start + other.duration)
          - Math.max(scene.start, other.start)).toBeLessThanOrEqual(0);
      }
    });
    const images = scenes(format).filter(scene => scene.type === 'drone').map(scene => scene.image);
    expect(new Set(images).size).toBe(images.length);
  }
});

test('the phone film keeps all supplied screenshot intervals available in the originals', () => {
  const requested = [
    [1, 1, 4], [1, 62, 4], [1, 91, 3],
    [2, 149, 4], [2, 49, 4], [2, 55, 2], [2, 116, 3],
    [4, 3, 6], [4, 78, 4], [4, 27, 5],
  ];
  for (const [source, start, duration] of requested) {
    expect(scenes('portrait')).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'video', source, start, duration }),
    ]));
  }
  const originals = plan.sources.map((_, index) => index).filter(index => ![6, 8, 15].includes(index));
  expect([...new Set(scenes('portrait').filter(scene => scene.type === 'video').map(scene => scene.source))].sort((a, b) => a - b)).toEqual(originals);
});

test('both formats restore only the moments shown in the seven supplied live screenshots', () => {
  const approved = [
    ['gold-sky', 22, '29', 'IMG_1812.mov', 132.3, 4],
    ['multicolor-sky', 18, '32', 'IMG_9074.mov', 139, 2.75],
    ['pink-gold-fan', 19, '01', 'GX011243.mp4', 33, 2.25],
    ['color-building', 20, '27', 'IMG_0211.mov', 5.1, 2.25],
    ['red-canopy', 19, '01', 'GX011243.mp4', 58.3, 2.5],
    ['white-bursts', 21, '28', 'IMG_0281.mov', 3, 2],
    ['pink-gold-synchrony', 21, '28', 'IMG_0281.mov', 190.5, 2.25],
  ];
  for (const format of ['wide', 'portrait']) {
    const restored = scenes(format).filter(scene => scene.source >= 18);
    expect(restored).toHaveLength(approved.length);
    for (const [cue, source, inventoryIndex, name, start, duration] of approved) {
      expect(plan.sources[source]).toEqual({ name, inventoryIndex });
      expect(restored.filter(scene => scene.approvedLiveCue === cue)).toEqual([
        expect.objectContaining({ type: 'video', source, start, duration }),
      ]);
    }
  }
});
