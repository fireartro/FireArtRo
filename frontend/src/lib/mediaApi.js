import { upload } from '@vercel/blob/client';

export const MEDIA_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'video/mp4', 'video/webm'];
const extension = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/avif': 'avif', 'video/mp4': 'mp4', 'video/webm': 'webm' };
export function validateMediaFile(file) {
  if (!file || !MEDIA_TYPES.includes(file.type)) throw new Error('Alege o imagine JPG, PNG, WebP, AVIF sau un video MP4/WebM.');
  const maximum = file.type.startsWith('video/') ? 500 : 8;
  if (!file.size || file.size > maximum * 1024 * 1024) throw new Error(`Fișierul poate avea cel mult ${maximum} MB.`);
}
export async function uploadMediaFile(file, { csrfToken, altText, onProgress }) {
  validateMediaFile(file);
  const id = `media-${crypto.randomUUID()}`;
  const pathname = `cms/${id}/asset.${extension[file.type]}`;
  const blob = await upload(pathname, file, { access: 'public', handleUploadUrl: '/api/admin/blob-upload',
    multipart: file.type.startsWith('video/'), onUploadProgress: onProgress,
    clientPayload: JSON.stringify({ mediaId: id, csrfToken, contentType: file.type, size: file.size, filename: file.name, altText }),
  });
  return { id, blob };
}
export const listMedia = (request, offset = 0) => request(`/api/admin/media?limit=100&offset=${offset}`);
export const getMedia = (request, id) => request(`/api/admin/media/${encodeURIComponent(id)}`);
export const updateMediaAlt = (request, id, altText) => request(`/api/admin/media/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ alt_text: altText }) });
export const deleteMedia = (request, id) => request(`/api/admin/media/${encodeURIComponent(id)}`, { method: 'DELETE', body: JSON.stringify({ confirm_id: id }) });
export const reconcilePendingMedia = (request, id) => request('/api/admin/blob-upload', {
  method: 'POST',
  body: JSON.stringify({ type: 'fireartro.reconcile-pending', payload: { mediaId: id } }),
});
