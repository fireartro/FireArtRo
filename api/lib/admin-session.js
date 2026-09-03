import { createHmac, timingSafeEqual } from 'node:crypto';

export class UploadError extends Error {
  constructor(status, message = 'Cererea media nu este permisă.') {
    super(message);
    this.status = status;
  }
}

export const hashToken = (value, secret) => createHmac('sha256', secret).update(value, 'utf8').digest('hex');
const equalHash = (left, right) => typeof left === 'string' && /^[a-f0-9]{64}$/.test(left)
  && timingSafeEqual(Buffer.from(left, 'hex'), Buffer.from(right, 'hex'));

export function header(request, name) {
  const value = request.headers?.get ? request.headers.get(name) : request.headers?.[name];
  if (Array.isArray(value)) throw new UploadError(403);
  // IncomingMessage retains duplicate headers in rawHeaders even when coalesced.
  if (request.rawHeaders?.filter((value, index) => index % 2 === 0 && value.toLowerCase() === name).length > 1) {
    throw new UploadError(403);
  }
  return typeof value === 'string' ? value : '';
}

function parseOrigin(value) {
  if (!/^https?:\/\/[^/?#\s\\]+$/.test(value) || value.endsWith(':')) throw new UploadError(403);
  let parsed;
  try { parsed = new URL(value); } catch { throw new UploadError(403); }
  if (parsed.username || parsed.password) throw new UploadError(403);
  return parsed.origin;
}

export function requestOrigin(request, env) {
  let protocol = request.socket?.encrypted ? 'https' : 'http';
  if (request.url?.startsWith('https://')) protocol = 'https';
  const forwarded = header(request, 'x-forwarded-proto');
  if (env.VERCEL === '1' && forwarded) {
    if (!['http', 'https'].includes(forwarded)) throw new UploadError(403);
    protocol = forwarded;
  }
  return parseOrigin(`${protocol}://${header(request, 'host')}`);
}

export async function requireAdminUploadSession(request, csrfToken, { db, env = process.env, now = new Date() }) {
  const secret = env.ADMIN_SESSION_SECRET;
  const bytes = typeof secret === 'string' ? Buffer.byteLength(secret) : 0;
  if (bytes < 32 || bytes > 4096 || !secret.trim() || secret.includes('\0') || !env.ADMIN_USERNAME?.trim()) {
    throw new UploadError(503, 'Administrarea nu este disponibilă momentan.');
  }
  const cookies = header(request, 'cookie').split(';').map((part) => part.trim())
    .filter((part) => part.startsWith('fireartro_admin_session='));
  const raw = cookies.length === 1 ? cookies[0].slice('fireartro_admin_session='.length) : '';
  if (!/^[A-Za-z0-9_-]{64}$/.test(raw)) throw new UploadError(401);
  const tokenHash = hashToken(raw, secret);
  const session = await db.collection('admin_sessions').findOne({
    token_hash: tokenHash, expires_at: { $gt: now }, revoked_at: null,
  });
  if (!session || session.revoked_at != null || !(session.expires_at instanceof Date)
    || !(session.expires_at > now)) throw new UploadError(401);
  const derivedCsrf = createHmac('sha256', secret)
    .update('fireartro:admin-csrf:v1\0' + raw).digest('base64url');
  if (!equalHash(session.csrf_hash, hashToken(derivedCsrf, secret))) throw new UploadError(401);
  if (typeof csrfToken !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(csrfToken)
    || !equalHash(session.csrf_hash, hashToken(csrfToken, secret))) throw new UploadError(403);
  const origin = header(request, 'origin');
  // Like Python, non-browser requests may omit Origin but still need cookie + CSRF.
  if ((origin && parseOrigin(origin) !== requestOrigin(request, env))
    || ['cross-site', 'same-site'].includes(header(request, 'sec-fetch-site'))) throw new UploadError(403);
  return { username: env.ADMIN_USERNAME, expiresAt: session.expires_at };
}
