export const LOCAL_MEDIA_FALLBACK = '/media/coperta-spectacol-artificii-fireartro.webp';

const GOOGLE_MEDIA_HOSTS = [
  'youtube.com', 'youtube-nocookie.com', 'youtu.be', 'ytimg.com', 'googlevideo.com', 'googleusercontent.com',
];

export function isOptionalGoogleMedia(value) {
  if (!value) return false;
  try {
    const hostname = new URL(value, 'https://fireart.ro').hostname.replace(/\.$/, '');
    return GOOGLE_MEDIA_HOSTS.some(host => hostname === host || hostname.endsWith(`.${host}`));
  } catch {
    return false;
  }
}

export function allowedGoogleMedia(value, marketingAllowed, fallback) {
  return !marketingAllowed && isOptionalGoogleMedia(value) ? fallback : value;
}
