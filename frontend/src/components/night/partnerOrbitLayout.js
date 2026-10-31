const rings = 3;
const steps = 90;
export const ORBIT_DURATION = 70000;

export function partnerPhase(index, count) {
  const ring = index % rings;
  const population = Math.ceil((count - ring) / rings);
  return Math.floor(index / rings) / population + ring * .42 / (2 * Math.PI);
}

export function orbitCamera(width, height, headingWidth = 0, headingHeight = 0) {
  const portrait = height > width * 1.15;
  const cardWidth = Math.min(128, Math.max(48, width * (portrait ? .15 : .08)), height * .22);
  const cardHeight = cardWidth * .66;
  const maxScale = 1 / .72;
  return {
    cardWidth, cardHeight,
    radiusX: Math.max(1, width / 2 - cardWidth * maxScale / 2 - 10),
    radiusY: Math.max(1, height / 2 - cardHeight * maxScale / 2 - 14),
    headingWidth, headingHeight,
  };
}

// The title remains the fixed centre. Three intersecting ellipses carry the
// whole catalogue around it, with near and far cards sorted by camera depth.
export function ringKeyframes(ring, camera) {
  return Array.from({length: steps + 1}, (_, step) => {
    const angle = (step % steps) * Math.PI * 2 / steps;
    const depth = Math.sin(angle);
    const scale = 1 / (1 - depth * .28);
    let x = Math.cos(angle) * camera.radiusX * (.82 + ring * .09);
    let y = Math.sin(angle) * camera.radiusY * (1 - ring * .09);
    const halfWidth = camera.headingWidth / 2 + camera.cardWidth * scale / 2 + 7;
    const halfHeight = camera.headingHeight / 2 + camera.cardHeight * scale / 2 + 7;
    // A rounded rectangular clearance follows the actual typeset heading.
    // Calculated only on resize, it keeps lettering and logos from crossing.
    const clearance = Math.max(1, (2 / ((Math.abs(x) / halfWidth) ** 12 + (Math.abs(y) / halfHeight) ** 12)) ** (1 / 12));
    x *= clearance;
    y *= clearance;
    return {
      transform: `translate(${x.toFixed(3)}px, ${y.toFixed(3)}px) scale(${scale.toFixed(5)})`,
      zIndex: Math.round(512 + depth * 500),
    };
  });
}
