import { createSettlingTicker } from './settlingTicker';

function setup() {
  const callbacks = new Set();
  const ticker = {
    add: jest.fn(callback => callbacks.add(callback)),
    remove: jest.fn(callback => callbacks.delete(callback)),
  };
  let current = 0;
  let target = 0;
  const advance = jest.fn(next => {
    const delta = next - current;
    current = Math.abs(delta) < 0.001 ? next : current + delta * 0.5;
  });
  const motion = createSettlingTicker(ticker, {
    readCurrent: () => current,
    readTarget: () => target,
    advance,
  });
  return { ticker, callbacks, advance, motion,
    setTarget: next => { target = next; },
    frame: () => [...callbacks].forEach(callback => callback()),
    readCurrent: () => current,
  };
}

test('does no frame work at rest, eases across frames, then releases the ticker', () => {
  const scene = setup();
  scene.motion.wake();
  expect(scene.ticker.add).not.toHaveBeenCalled();
  scene.setTarget(1);
  scene.motion.wake();
  scene.motion.wake();
  expect(scene.ticker.add).toHaveBeenCalledTimes(1);
  scene.frame();
  expect(scene.readCurrent()).toBeGreaterThan(0);
  expect(scene.readCurrent()).toBeLessThan(1);
  for (let frame = 0; frame < 20; frame += 1) scene.frame();
  expect(scene.readCurrent()).toBe(1);
  expect(scene.callbacks.size).toBe(0);
  const updates = scene.advance.mock.calls.length;
  scene.frame();
  expect(scene.advance).toHaveBeenCalledTimes(updates);
});

test('follows reversed scroll, restarts after settling, and cleans up on unmount', () => {
  const scene = setup();
  scene.setTarget(1);
  scene.motion.wake();
  scene.frame();
  scene.setTarget(0);
  scene.frame();
  expect(scene.readCurrent()).toBe(0.25);
  for (let frame = 0; frame < 20; frame += 1) scene.frame();
  scene.setTarget(0.8);
  scene.motion.wake();
  expect(scene.callbacks.size).toBe(1);
  scene.motion.stop();
  expect(scene.callbacks.size).toBe(0);
});

test('releases the ticker if a resize removes the scroll range', () => {
  const scene = setup();
  scene.setTarget(1);
  scene.motion.wake();
  scene.setTarget(undefined);
  scene.frame();
  expect(scene.advance).not.toHaveBeenCalled();
  expect(scene.callbacks.size).toBe(0);
});
