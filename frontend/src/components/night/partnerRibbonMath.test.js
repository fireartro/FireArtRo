import { CARD_LENGTH, CARD_PITCH, createPartnerPath, leadingDistance, writePartnerPoint } from './partnerRibbonMath';
import { sampleWeblyHelix } from './weblyHelixMath';

test('keeps the Webly bank and dip that curve the face of each card', () => {
  // Positions exported by Webly Digital's writeHelixCardVertex.
  const samples = [
    [0, -0.5, -0.5, [12, -18.0153518555, 0.2323362321]],
    [60, -0.3, 0.2, [3.4835206762, -5.6927733227, -11.4833574847]],
    [90, 0.4, -0.4, [0.3572517189, -1.6214528691, 11.9977378375]],
  ];
  for (const [arc, column, row, expected] of samples) {
    const angle = (arc + (column + 0.5) * 5.8) / Math.hypot(12, 28 / (4 * Math.PI));
    const p = sampleWeblyHelix(angle);
    const height = row * 5.8 * (568 / 812);
    [p.x + p.upX * height, p.y + p.upY * height, p.z + p.upZ * height]
      .forEach((value, axis) => expect(value).toBeCloseTo(expected[axis], 8));
  }
});

test.each([7, 10.4])('the two ribbons alternate front and back at all three crossings (radius %d)', radius => {
  const path = createPartnerPath(radius, 32);
  const left = [], right = [], crossings = [];
  let prevX = -Infinity;
  for (let i = 0; i <= 400; i++) {
    const d = path.length * i / 400;
    writePartnerPoint(left, path, d, 0, 0);
    writePartnerPoint(right, path, d, 0, 1);
    expect(left[0]).toBeCloseTo(-right[0]);
    expect(left[1]).toBeCloseTo(right[1]);
    expect(left[2]).toBeCloseTo(-right[2]);
    if (Math.sign(left[0]) !== Math.sign(prevX)) crossings.push(left[2] - right[2]);
    prevX = left[0];
  }
  expect(crossings).toHaveLength(3);
  expect(crossings[0]).toBeLessThan(-14);
  expect(crossings[1]).toBeGreaterThan(14);
  expect(crossings[2]).toBeLessThan(-14);
  writePartnerPoint(left, path, 0, 0, 0);
  writePartnerPoint(right, path, path.length, 0, 0);
  expect(left[0]).toBeCloseTo(-32);
  expect(right[0]).toBeCloseTo(32);
  expect(right[1]).toBeGreaterThan(left[1]);
});

test.each([1, 7, 26])('the train of %d partners enters and leaves completely', count => {
  const length = 133;
  for (let index = 0; index < count; index++) {
    const offset = Math.floor(index / 2) * CARD_PITCH;
    expect(leadingDistance(0, length, count) - offset).toBeLessThanOrEqual(0);
    expect(leadingDistance(1, length, count) - offset - CARD_LENGTH).toBeGreaterThanOrEqual(length - 1e-8);
  }
});
