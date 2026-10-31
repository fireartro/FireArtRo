import { sampleWeblyHelix } from './weblyHelixMath';

export const CARD_LENGTH = 5.8;
export const CARD_PITCH = 6.04;
export const CARD_HEIGHT = 2.12;
const TURN = 3 * Math.PI;
const coreSteps = 288;
const tailSteps = 40;

function corePoint(angle, radiusX) {
  const point = sampleWeblyHelix(angle);
  return {
    ...point,
    x: point.x * radiusX / 12,
    y: (point.y + 5.5) * 0.82,
    z: point.z * 0.64,
  };
}

// A tangent lead at each end carries the train all the way past the viewport.
// Bending out in X quadratically preserves the vertical-axis helix at the join.
function tailPoint(end, u, extent, radiusX, direction) {
  return {
    ...end,
    x: end.x - direction * (extent - radiusX) * u * u,
    y: end.y + direction * 1.25 * u,
    z: end.z - 4.4 * Math.sin(u * Math.PI / 2),
    upX: end.upX * (1 - u),
    upY: end.upY + (1 - end.upY) * u,
    upZ: end.upZ * (1 - u),
  };
}

export function createPartnerPath(radiusX, extent) {
  const samples = [];
  const first = corePoint(0, radiusX);
  const last = corePoint(TURN, radiusX);
  for (let i = tailSteps; i > 0; i--) {
    samples.push(tailPoint(first, i / tailSteps, extent, radiusX, -1));
  }
  for (let i = 0; i <= coreSteps; i++) {
    samples.push(corePoint(TURN * i / coreSteps, radiusX));
  }
  for (let i = 1; i <= tailSteps; i++) {
    samples.push(tailPoint(last, i / tailSteps, extent, radiusX, 1));
  }
  let length = 0;
  samples.forEach((p, i) => {
    const prev = samples[i - 1];
    if (prev) length += Math.hypot(p.x - prev.x, p.y - prev.y, p.z - prev.z);
    p.distance = length;
  });

  // Re-sample at a constant arc spacing. This keeps logos the same physical
  // width on the straight approaches and around the near/far bends.
  const steps = Math.ceil(length * 10);
  const frames = new Float32Array((steps + 1) * 6);
  const fields = ['x', 'y', 'z', 'upX', 'upY', 'upZ'];
  let segment = 1;
  for (let i = 0; i <= steps; i++) {
    const d = i * length / steps;
    while (segment < samples.length - 1 && samples[segment].distance < d) segment++;
    const a = samples[segment - 1];
    const b = samples[segment];
    const mix = (d - a.distance) / (b.distance - a.distance);
    fields.forEach((key, j) => { frames[i * 6 + j] = a[key] + (b[key] - a[key]) * mix; });
  }
  return { frames, steps, length };
}

export function writePartnerPoint(target, path, distance, verticalOffset, lane) {
  const at = Math.min(path.steps, Math.max(0, distance * path.steps / path.length));
  const index = Math.min(Math.floor(at), path.steps - 1);
  const a = index * 6;
  const mix = at - index;
  const f = path.frames;
  const sign = lane === 0 ? -1 : 1;
  // Rotate the second train half a revolution in 3D, so the near side
  // switches at every crossing. Both trains share the very same vertical axis.
  for (let axis = 0; axis < 3; axis++) {
    const j = a + axis;
    const center = f[j] + (f[j + 6] - f[j]) * mix;
    const up = f[j + 3] + (f[j + 9] - f[j + 3]) * mix;
    target[axis] = (center + up * verticalOffset) * (axis === 1 ? 1 : sign);
  }
}

export function leadingDistance(progress, pathLength, count) {
  const trainLength = (Math.ceil(count / 2) - 1) * CARD_PITCH + CARD_LENGTH;
  return progress * (pathLength + trainLength);
}
