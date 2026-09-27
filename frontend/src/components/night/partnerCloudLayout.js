// Perimeter positions leave the reading area empty; no marks orbit over text.
const desktop = [
  ...[8, 22, 36, 50, 64, 78, 92].map(x => [x, 11]),
  ...[32, 50, 68].flatMap(y => [[8, y], [22, y], [78, y], [92, y]]),
  ...[8, 22, 36, 50, 64, 78, 92].map(x => [x, 89]),
];
const mobile = [[15, 9], [50, 9], [85, 9], [15, 25], [85, 25], [15, 75], [85, 75], [15, 92], [50, 92], [85, 92]];
export function partnerCloudStyle(index) {
  const [x, y] = desktop[index % desktop.length];
  const [mx, my] = mobile[index % mobile.length];
  return {
    "--partner-x": `${x}%`, "--partner-y": `${y}%`,
    "--partner-mobile-x": `${mx}%`, "--partner-mobile-y": `${my}%`,
    "--partner-tilt": `${(index % 5 - 2) * 2}deg`,
    "--partner-duration": `${15 + index % 7}s`,
    "--partner-phase": `${-index * 1.7}s`,
  };
}
