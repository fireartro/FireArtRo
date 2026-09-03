import {
  SAFE_ANCHORS,
  chooseSafeAnchor,
  createCarrierPlan,
  sampleHermiteCarrier,
  sampleTravellingHelix,
} from "./galleryCometChoreography";

describe("gallery comet choreography", () => {
  const carrier = createCarrierPlan({
    start: [-2, -0.5, 0],
    end: [2, 0.8, 0.3],
    startDirection: [1, 0.2, 0],
    endDirection: [1, -0.1, 0.1],
  });

  test("carrier advances through the scene", () => {
    const start = sampleHermiteCarrier(carrier, 0.12);
    const end = sampleHermiteCarrier(carrier, 0.88);
    expect(end.position[0] - start.position[0]).toBeGreaterThan(2.5);
    expect(Math.hypot(...end.tangent)).toBeCloseTo(1, 4);
  });

  test("helix members stay separated around a moving carrier", () => {
    const first = sampleTravellingHelix({ carrier, progress: 0.45, slot: 0, memberCount: 3, radius: 0.4 });
    const second = sampleTravellingHelix({ carrier, progress: 0.45, slot: 1, memberCount: 3, radius: 0.4 });
    const separation = Math.hypot(...first.position.map((value, index) => value - second.position[index]));
    expect(separation).toBeGreaterThan(0.55);
    expect(first.carrierPosition[0]).toBeGreaterThan(-0.5);
  });

  test("fusion contracts onto the moving carrier", () => {
    const fused = sampleTravellingHelix({ carrier, progress: 0.76, slot: 2, radius: 0.42, contraction: 1 });
    const distance = Math.hypot(...fused.position.map((value, index) => value - fused.carrierPosition[index]));
    expect(distance).toBeLessThan(0.001);
    expect(fused.carrierPosition[0]).toBeGreaterThan(0.7);
  });

  test("rotation can accelerate independently from carrier travel", () => {
    const normal = sampleTravellingHelix({ carrier, progress: 0.5, rotationProgress: 0.25, slot: 0, radius: 0.4 });
    const accelerated = sampleTravellingHelix({ carrier, progress: 0.5, rotationProgress: 0.7, slot: 0, radius: 0.4 });
    expect(accelerated.carrierPosition).toEqual(normal.carrierPosition);
    expect(accelerated.position).not.toEqual(normal.position);
  });

  test("safe anchor avoids blocked and repeated zones", () => {
    const chosen = chooseSafeAnchor({
      anchors: SAFE_ANCHORS,
      from: SAFE_ANCHORS[0],
      direction: [1, 0],
      viewport: { width: 1200, height: 800 },
      blockedRects: [{ left: 900, right: 1200, top: 0, bottom: 360 }],
      sequence: 3,
    });
    expect(chosen.id).not.toBe(SAFE_ANCHORS[0].id);
    expect(chosen.id).not.toBe("east-high");
    expect(Math.hypot(chosen.x, chosen.y)).toBeGreaterThan(0.7);
  });
});
