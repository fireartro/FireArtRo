const EPSILON = 1e-6;

export const SAFE_ANCHORS = [
  { id: "west-high", x: -0.98, y: 0.7, z: -0.18 },
  { id: "west-low", x: -0.98, y: -0.68, z: 0.24 },
  { id: "north-west", x: -0.48, y: 0.92, z: 0.42 },
  { id: "north-east", x: 0.5, y: 0.92, z: -0.32 },
  { id: "east-high", x: 0.98, y: 0.66, z: 0.18 },
  { id: "east-low", x: 0.98, y: -0.7, z: -0.4 },
  { id: "south-east", x: 0.5, y: -0.92, z: 0.36 },
  { id: "south-west", x: -0.5, y: -0.92, z: -0.22 },
];

export const clamp = (value, minimum = 0, maximum = 1) => Math.min(maximum, Math.max(minimum, value));

export const smoothstep = (value, minimum = 0, maximum = 1) => {
  const amount = clamp((value - minimum) / Math.max(EPSILON, maximum - minimum));
  return amount * amount * (3 - 2 * amount);
};

const add = (first, second) => first.map((value, index) => value + second[index]);
const subtract = (first, second) => first.map((value, index) => value - second[index]);
const scale = (vector, amount) => vector.map((value) => value * amount);
const dot = (first, second) => first.reduce((total, value, index) => total + value * second[index], 0);
const length = (vector) => Math.sqrt(dot(vector, vector));
const normalize = (vector) => {
  const magnitude = length(vector);
  return magnitude < EPSILON ? [1, 0, 0] : scale(vector, 1 / magnitude);
};
const cross = (first, second) => [
  first[1] * second[2] - first[2] * second[1],
  first[2] * second[0] - first[0] * second[2],
  first[0] * second[1] - first[1] * second[0],
];

const seededUnit = (seed) => {
  const value = Math.sin((seed + 1) * 12.9898) * 43758.5453;
  return value - Math.floor(value);
};

const pointInsideRect = (x, y, rect, margin = 32) => (
  x >= rect.left - margin &&
  x <= rect.right + margin &&
  y >= rect.top - margin &&
  y <= rect.bottom + margin
);

export function chooseSafeAnchor({
  anchors = SAFE_ANCHORS,
  from = null,
  direction = [1, 0],
  viewport = { width: 1440, height: 900 },
  blockedRects = [],
  sequence = 0,
  excludedIds = [],
} = {}) {
  const safeDirection = normalize([direction[0] || 0, direction[1] || 0, 0]);
  const origin = from || { id: "origin", x: 0, y: 0, z: 0 };
  const excluded = new Set([origin.id, ...excludedIds]);

  return anchors
    .filter((anchor) => !excluded.has(anchor.id))
    .map((anchor, index) => {
      const travel = [anchor.x - origin.x, anchor.y - origin.y, 0];
      const travelDirection = normalize(travel);
      const screenX = ((anchor.x + 1) * 0.5) * viewport.width;
      const screenY = ((1 - anchor.y) * 0.5) * viewport.height;
      const blockedPenalty = blockedRects.reduce(
        (penalty, rect) => penalty + (pointInsideRect(screenX, screenY, rect) ? 4.5 : 0),
        0,
      );
      const centerPenalty = Math.max(0, 0.42 - Math.hypot(anchor.x, anchor.y)) * 8;
      const distanceReward = Math.min(2.2, length(travel) * 1.7);
      const directionReward = dot(safeDirection, travelDirection) * 1.35;
      const deterministicVariation = seededUnit(sequence * 17 + index * 7) * 0.42;
      return {
        anchor,
        score: distanceReward + directionReward + deterministicVariation - blockedPenalty - centerPenalty,
      };
    })
    .sort((first, second) => second.score - first.score)[0]?.anchor || anchors[0];
}

export function createCarrierPlan({ start, end, startDirection, endDirection, bend = 0.2 }) {
  const distance = Math.max(0.25, length(subtract(end, start)));
  const chord = normalize(subtract(end, start));
  const entry = normalize(startDirection || chord);
  const exit = normalize(endDirection || chord);
  const tangentLength = distance * (0.52 + clamp(bend, 0, 1) * 0.24);

  return {
    start: [...start],
    end: [...end],
    startTangent: scale(normalize(add(scale(chord, 1.8), entry)), tangentLength),
    endTangent: scale(normalize(add(scale(chord, 1.65), exit)), tangentLength),
  };
}

export function sampleHermiteCarrier(plan, progress) {
  const t = clamp(progress);
  const t2 = t * t;
  const t3 = t2 * t;
  const h00 = 2 * t3 - 3 * t2 + 1;
  const h10 = t3 - 2 * t2 + t;
  const h01 = -2 * t3 + 3 * t2;
  const h11 = t3 - t2;
  const dh00 = 6 * t2 - 6 * t;
  const dh10 = 3 * t2 - 4 * t + 1;
  const dh01 = -6 * t2 + 6 * t;
  const dh11 = 3 * t2 - 2 * t;

  const position = [0, 1, 2].map((index) => (
    h00 * plan.start[index] +
    h10 * plan.startTangent[index] +
    h01 * plan.end[index] +
    h11 * plan.endTangent[index]
  ));
  const derivative = [0, 1, 2].map((index) => (
    dh00 * plan.start[index] +
    dh10 * plan.startTangent[index] +
    dh01 * plan.end[index] +
    dh11 * plan.endTangent[index]
  ));

  return { position, tangent: normalize(derivative) };
}

export function createTransportFrame(tangent, previousNormal = null) {
  const safeTangent = normalize(tangent);
  let normal = previousNormal
    ? subtract(previousNormal, scale(safeTangent, dot(previousNormal, safeTangent)))
    : cross(Math.abs(safeTangent[2]) < 0.84 ? [0, 0, 1] : [0, 1, 0], safeTangent);

  if (length(normal) < 0.05) normal = cross([1, 0, 0], safeTangent);
  normal = normalize(normal);
  const binormal = normalize(cross(safeTangent, normal));
  normal = normalize(cross(binormal, safeTangent));
  return { tangent: safeTangent, normal, binormal };
}

export function sampleTravellingHelix({
  carrier,
  progress,
  rotationProgress = progress,
  slot = 0,
  memberCount = 3,
  radius = 0.36,
  turns = 1.8,
  contraction = 0,
  previousNormal = null,
  direction = 1,
}) {
  const sample = sampleHermiteCarrier(carrier, progress);
  const frame = createTransportFrame(sample.tangent, previousNormal);
  const phase = direction * rotationProgress * turns * Math.PI * 2 + (slot / memberCount) * Math.PI * 2;
  const activeRadius = Math.max(0, radius * (1 - clamp(contraction)));
  const radial = add(
    scale(frame.normal, Math.cos(phase) * activeRadius),
    scale(frame.binormal, Math.sin(phase) * activeRadius),
  );

  return {
    position: add(sample.position, radial),
    carrierPosition: sample.position,
    tangent: sample.tangent,
    normal: frame.normal,
    binormal: frame.binormal,
    radius: activeRadius,
  };
}
