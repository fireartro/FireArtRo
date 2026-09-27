// Hand-composed lanes keep the reading area clear while breaking the perimeter grid.
// Order jumps between regions so a short Admin list still fills the scene.
const desktop = [
  [23.1, 14.3, 1.03, 70], [91.3, 52.8, .91, -50], [52.8, 10.1, 1.08, 85],
  [8.4, 69.2, .96, 10], [76.8, 13.4, 1.02, 45], [35.9, 90.6, .89, -35],
  [22.8, 51.4, .95, 20], [91.4, 89.1, .82, -65], [9.2, 10.5, .83, -60],
  [77.4, 49.7, 1.04, 80], [50.6, 88.8, .91, -25], [22.2, 70.4, 1.06, 75],
  [90.8, 15.1, .96, 15], [37.1, 8.6, .86, -40], [9.7, 48.5, 1.02, 50],
  [77.9, 68.3, .91, -20], [65.8, 91.2, 1.02, 55], [10.2, 87.8, .91, -15],
  [77.1, 31.6, .84, -55], [64.7, 8.3, .87, -30], [8.7, 29.4, 1.02, 60],
  [90.2, 34.1, 1.04, 70], [23.5, 33.3, .85, -45], [78, 88.8, 1.04, 65],
  [23.8, 86.6, .91, -25], [91.7, 72.1, .88, -35],
];

const mobile = [
  [15, 10], [85, 25], [51, 9], [13, 77], [86, 10],
  [49, 92], [14, 25], [85, 92], [51, 77], [86, 77],
];
export function partnerCloudStyle(index) {
  const cycle = Math.floor(index / desktop.length);
  const [baseX, baseY, scale, depth] = desktop[index % desktop.length];
  const [mx, my] = mobile[index % mobile.length];
  const offset = cycle / (cycle + 1) * .35;
  return {
    "--partner-x": `${baseX + offset}%`, "--partner-y": `${baseY + offset}%`,
    "--partner-mobile-x": `${mx}%`, "--partner-mobile-y": `${my}%`,
    "--partner-scale": scale,
    "--partner-depth": `${depth}px`,
    "--partner-tilt": `${(index % 7 - 3) * 1.5}deg`,
    "--partner-duration": `${17 + index % 8}s`,
    "--partner-phase": `${-index * 1.3}s`,
  };
}
