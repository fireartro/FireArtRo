// CSS pixels alone undercount the pixels on Retina and high-DPI screens.
// Explicit data-saving and slow connections keep the smaller rendition.
export function selectHeroDelivery(width, height, dpr = 1, connection = {}, format = 'wide') {
  if (connection.saveData) return 'hd';
  const downlink = Number(connection.downlink);
  const measured = Number.isFinite(downlink) && downlink > 0;
  if (['slow-2g', '2g', '3g'].includes(connection.effectiveType) || (measured && downlink <= 2.5)) return 'light';
  if ((measured && downlink < 8) || (!measured && (format === 'portrait' || Math.min(width, height) < 600))) return 'hd';
  const physicalPixels = Math.max(width, height) * Math.max(1, dpr);
  if (physicalPixels >= 3200 && format !== 'portrait') return 'uhd';
  if (physicalPixels > 2000) return 'retina';
  return 'hd';
}
