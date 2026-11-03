import names from '@/data/romanianImageNames.json';

// Exact bundled assets only. Uploads and third-party URLs keep their identity.
export function romanianImageUrl(value) {
  if (typeof value !== 'string' || !value) return value;
  const absolute = /^https?:\/\//.test(value);
  if (!value.startsWith('/media/') && !absolute) return value;
  try {
    const url = new URL(value, 'https://fireart.ro');
    if (!['https://fireart.ro', 'https://www.fireart.ro'].includes(url.origin)) return value;
    const replacement = names.paths[url.pathname];
    if (!replacement) return value;
    return `${absolute ? url.origin : ''}${replacement}${url.search}${url.hash}`;
  } catch { return value; }
}

function sameImage(value, target) {
  try {
    const url = new URL(romanianImageUrl(value), 'https://fireart.ro');
    return ['https://fireart.ro', 'https://www.fireart.ro'].includes(url.origin) && url.pathname === target;
  } catch { return false; }
}

// A public projection: historical CMS publications and drafts are never mutated.
// Only unchanged imported copy is translated; later editorial choices win.
export function localizePublicImages(value) {
  if (typeof value === 'string') return romanianImageUrl(value);
  if (!value || typeof value !== 'object') return value;
  let next = value;
  for (const key of Object.keys(value)) {
    const item = localizePublicImages(value[key]);
    if (item !== value[key]) {
      if (next === value) next = Array.isArray(value) ? [...value] : {...value};
      next[key] = item;
    }
  }
  const rule = value.type === 'image' && names.metadata[value.id];
  if (rule && sameImage(value.src, rule.src)) {
    for (const [field, copy] of Object.entries(rule.fields)) {
      if (value[field] === copy.before && copy.before !== copy.after) {
        if (next === value) next = {...value};
        next[field] = copy.after;
      }
    }
  }
  return next;
}
