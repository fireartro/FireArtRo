// CSS pixels alone undercount the pixels on Retina and high-DPI screens.
// Explicit data-saving and slow connections keep the smaller rendition.
export function selectHeroDelivery(width, height, dpr = 1, connection = {}) {
  if (connection.saveData || ['slow-2g', '2g', '3g'].includes(connection.effectiveType)) return 'hd';
  return Math.max(width, height) * Math.max(1, dpr) > 2000 ? 'uhd' : 'hd';
}
