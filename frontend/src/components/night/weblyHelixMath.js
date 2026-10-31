// The rolling frame and scroll response used by Webly Digital's project helix.
const radius = 12;
const pitch = 28 / (4 * Math.PI);

export function sampleWeblyHelix(angle) {
  const sine = Math.sin(angle);
  const cosine = Math.cos(angle);
  const offset = angle - 2 * Math.PI;
  const dip = 2.5 * Math.exp(-(offset * offset) / 4);
  const rise = pitch + offset * dip / 2;

  // Cross the tangent with the radial vector, then bias the bank toward world up.
  const length = Math.hypot(radius, rise);
  const upX = rise * sine / length;
  const upY = radius / length + 0.6;
  const upZ = -rise * cosine / length;
  const normal = Math.hypot(upX, upY, upZ);
  return {
    x: radius * cosine, y: -16 + angle * pitch - dip, z: radius * sine,
    upX: upX / normal, upY: upY / normal, upZ: upZ / normal,
  };
}

export function damp(current, target, deltaSeconds) {
  return current + (target - current) * (1 - Math.pow(0.001, deltaSeconds));
}
