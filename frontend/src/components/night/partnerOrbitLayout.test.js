import { orbitCamera, partnerPhase, ringKeyframes } from './partnerOrbitLayout';

test.each([1, 2, 12, 26, 31])('evenly spaces each latitude for %s managed partners', count => {
  for (let ring = 0; ring < Math.min(3, count); ring++) {
    const phases = [];
    for (let i = ring; i < count; i += 3) phases.push(partnerPhase(i, count));
    phases.forEach((phase, i) => {
      const next = phases[i + 1] ?? phases[0] + 1;
      expect(next - phase).toBeCloseTo(1 / phases.length);
    });
  }
});

test.each([[300,325],[380,580],[820,225],[1320,280],[1440,725],[3600,1720]])('every depth fits the %sx%s camera and the loop closes', (width, height) => {
  const camera = orbitCamera(width, height);
  for (let ring = 0; ring < 3; ring++) {
    const frames = ringKeyframes(ring, camera);
    expect(frames.at(-1)).toEqual(frames[0]);
    const scales = frames.map(({transform}) => {
      const [x,y,scale] = transform.match(/-?[\d.]+/g).map(Number);
      expect(Math.abs(x) + camera.cardWidth / 2 * scale).toBeLessThan(width / 2);
      expect(Math.abs(y) + camera.cardHeight / 2 * scale).toBeLessThan(height / 2);
      return scale;
    });
    expect(Math.min(...scales)).toBeLessThan(1);
    expect(Math.max(...scales)).toBeGreaterThan(1);
  }
});
