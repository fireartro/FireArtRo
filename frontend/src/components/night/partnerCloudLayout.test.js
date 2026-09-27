import { partnerCloudStyle } from "./partnerCloudLayout";

test("distributes the full scene organically without repeating a position or entering the reading area", () => {
  const positions = Array.from({ length: 26 }, (_, index) => partnerCloudStyle(index, 26));
  const points = positions.map(style => [Number.parseFloat(style["--partner-x"]), Number.parseFloat(style["--partner-y"])]);
  expect(new Set(points.map(point => point.join(","))).size).toBe(26);
  expect(new Set(points.map(([x]) => x)).size).toBeGreaterThan(10);
  expect(new Set(points.map(([, y]) => y)).size).toBeGreaterThan(10);
  expect(new Set(positions.map(style => style["--partner-scale"])).size).toBeGreaterThan(3);
  expect(new Set(positions.map(style => style["--partner-depth"])).size).toBeGreaterThan(3);
  for (const [x, y] of points) {
    expect(x).toBeGreaterThanOrEqual(7);
    expect(x).toBeLessThanOrEqual(93);
    expect(y).toBeGreaterThanOrEqual(7);
    expect(y).toBeLessThanOrEqual(93);
    expect(x <= 30 || x >= 70 || y <= 24 || y >= 76).toBe(true);
  }
});

test("a short CMS list spans both sides and heights of the scene", () => {
  const points = Array.from({ length: 7 }, (_, index) => partnerCloudStyle(index, 7));
  const xs = points.map(style => Number.parseFloat(style["--partner-x"]));
  const ys = points.map(style => Number.parseFloat(style["--partner-y"]));
  expect(xs.some(x => x < 30)).toBe(true);
  expect(xs.some(x => x > 70)).toBe(true);
  expect(ys.some(y => y < 24)).toBe(true);
  expect(ys.some(y => y > 76)).toBe(true);
});

test("does not reuse a scene position when Admin adds a partner after the default catalogue", () => {
  const points = Array.from({ length: 31 }, (_, index) => {
    const style = partnerCloudStyle(index, 31);
    return `${style["--partner-x"]},${style["--partner-y"]}`;
  });
  expect(new Set(points).size).toBe(31);
});
