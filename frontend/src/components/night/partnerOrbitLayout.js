const rings = 3;
const steps = 60;
export const ORBIT_DURATION = 70000;

export function partnerPhase(index, count) {
  const ring = index % rings;
  const population = Math.ceil((count - ring) / rings);
  return Math.floor(index / rings) / population + ring * .42 / (2 * Math.PI);
}

export function orbitCamera(width, height) {
  const phone = width < 600;
  const cardWidth = Math.min(132, Math.max(70, width * (phone ? .195 : .092)), height * .68);
  const cardHeight = cardWidth * .66;
  const radius = Math.max(1, Math.min(width * .40, (width * .5 - cardWidth * .78 - 5) * .93));
  const verticalRoom = Math.max(0, height / 3.1 - cardHeight / 2 - 6);
  return {
    cardWidth, cardHeight, radius, perspective: radius * 2.95,
    lift: phone ? verticalRoom * .74 : Math.min(verticalRoom * .70, radius * .36),
    tilt: Math.min(verticalRoom * .25, phone ? 56 : Math.max(25, radius * .14)),
  };
}

// The three latitudes and stagger come from the first partner scene. All logos
// on one latitude share a native transform animation with a different phase.
export function ringKeyframes(ring, camera) {
  const latitude = (ring - 1) * .62;
  const belt = Math.cos(latitude) * (3.8 + ring * .16) / 3.96;
  return Array.from({length: steps + 1}, (_, step) => {
    const angle = (step % steps) * Math.PI * 2 / steps;
    const depth = Math.sin(angle) * belt;
    const x = Math.cos(angle) * belt * camera.radius;
    const y = (ring - 1) * camera.lift + depth * camera.tilt;
    const z = depth * camera.radius;
    const scale = camera.perspective / (camera.perspective - z);
    // Project once. An explicit stacking order also makes WebKit hit-test
    // overlapping links in the same order as Chromium and the camera.
    return {
      transform: `translate(${(x * scale).toFixed(3)}px, ${(y * scale).toFixed(3)}px) scale(${scale.toFixed(5)})`,
      zIndex: Math.round(512 + depth * 500),
    };
  });
}
