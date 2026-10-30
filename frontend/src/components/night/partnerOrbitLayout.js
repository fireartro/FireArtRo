const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const overlaps = (a, b, gap = 12) => a.left < b.right + gap && a.right + gap > b.left && a.top < b.bottom + gap && a.bottom + gap > b.top;

// Three spherical ribbons. Each uses its actual population, so adding partners
// never repeats the original four-slot angle and stacks multiple logos.
export function partnerOrbitLayout(count, width, height, angle, progress, heading) {
  const unit = Math.min(width / 11.2, height / 7.6);
  const assemble = clamp(progress / .18, 0, 1);
  const spread = 1 + (1 - assemble) * .35 + clamp((progress - .88) / .12, 0, 1) * .25;
  const cards = Array.from({ length: count }, (_, index) => {
    const ring = index % 3;
    const population = Math.ceil((count - ring) / 3);
    const theta = Math.floor(index / 3) / population * Math.PI * 2 + ring * .42 + angle;
    const latitude = (ring - 1) * .62;
    const radius = 3.8 + ring * .16;
    const z = Math.sin(theta) * radius * Math.cos(latitude);
    const perspective = 10.5 / (10.5 - z);
    const x = width / 2 + Math.cos(theta) * radius * Math.cos(latitude) * unit * perspective * spread;
    const y = height / 2 - Math.sin(latitude) * 2.35 * unit * perspective * spread;
    const scale = unit / 120 * perspective;
    const w = 164 * scale, h = 118 * scale;
    return { index, x, y, scale, z, left: x-w/2, right: x+w/2, top: y-h/2, bottom: y+h/2 };
  });
  const occupied = heading ? [heading] : [];
  // Front cards win occlusion; logo and caption always move as one surface.
  [...cards].sort((a,b)=>b.z-a.z).forEach(card => {
    const clearance = Math.min(card.left-18,width-18-card.right,card.top-82,height-24-card.bottom,
      ...occupied.map(box=>Math.max(box.left-card.right,card.left-box.right,box.top-card.bottom,card.top-box.bottom)));
    card.visible = card.left >= 18 && card.right <= width-18 && card.top >= 82 && card.bottom <= height-24
      && !occupied.some(box=>overlaps(card,box));
    if (card.visible) occupied.push(card);
    card.opacity = card.visible ? clamp(.7 + card.z / 14, .48, 1) * clamp(clearance/28,0,1) : 0;
  });
  return cards;
}
