import { randomBytes } from 'node:crypto';
import { handleUpload } from '@vercel/blob/client';
import { head as blobHead } from '@vercel/blob';
import { getDatabase } from '../lib/mongodb.js';
import { header, requestOrigin, requireAdminUploadSession, UploadError } from '../lib/admin-session.js';

const TYPES = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/avif': 'avif',
  'video/mp4': 'mp4', 'video/webm': 'webm',
};
const MEDIA_ID = /^media-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const MAX_BODY = 16 * 1024;
const bad = () => { throw new UploadError(400, 'Fișierul sau metadatele nu sunt valide.'); };

function json(value) {
  try { return typeof value === 'string' ? JSON.parse(value) : value; } catch { return bad(); }
}

function text(value, maximum) {
  if (typeof value !== 'string' || value.length > maximum || /[\x00-\x1f\x7f]/.test(value)) bad();
  return value.trim().replace(/\s+/g, ' ');
}

function configuredOrigin(env) {
  const origin = env.VERCEL_BLOB_MEDIA_ORIGIN;
  if (!env.BLOB_READ_WRITE_TOKEN?.trim()
    || !/^https:\/\/[a-z0-9]+\.public\.blob\.vercel-storage\.com$/.test(origin || '')) {
    throw new UploadError(503, 'Stocarea media nu este configurată.');
  }
  return origin;
}

function validateUpload(pathname, payload, multipart) {
  if (!payload || !MEDIA_ID.test(payload.mediaId) || !Object.hasOwn(TYPES, payload.contentType)) bad();
  const video = payload.contentType.startsWith('video/');
  const maximum = (video ? 500 : 8) * 1024 * 1024;
  if (!Number.isSafeInteger(payload.size) || payload.size < 1 || payload.size > maximum) bad();
  if (pathname !== `cms/${payload.mediaId}/asset.${TYPES[payload.contentType]}` || typeof multipart !== 'boolean') bad();
  if (video && !multipart) bad();
  for (const key of ['width', 'height']) {
    if (payload[key] != null && (!Number.isInteger(payload[key]) || payload[key] < 1 || payload[key] > 32768)) bad();
  }
  return {
    id: payload.mediaId, pathname, content_type: payload.contentType, declared_size: payload.size,
    filename: text(payload.filename || 'Fișier media', 180), alt_text: text(payload.altText || '', 240),
    width: payload.width ?? null, height: payload.height ?? null,
    dimensions_source: payload.width && payload.height ? 'client' : null,
  };
}

async function readBody(request) {
  if (header(request, 'content-type').split(';')[0].trim().toLowerCase() !== 'application/json') {
    throw new UploadError(415);
  }
  if (Number(header(request, 'content-length')) > MAX_BODY) throw new UploadError(413);
  if (request.body !== undefined) {
    const encoded = Buffer.isBuffer(request.body) ? request.body.toString('utf8') : request.body;
    if (Buffer.byteLength(typeof encoded === 'string' ? encoded : JSON.stringify(encoded)) > MAX_BODY) throw new UploadError(413);
    return json(encoded);
  }
  const parts = []; let length = 0;
  for await (const chunk of request) {
    length += Buffer.byteLength(chunk);
    if (length > MAX_BODY) throw new UploadError(413);
    parts.push(Buffer.from(chunk));
  }
  return json(Buffer.concat(parts).toString('utf8'));
}

/** Node IncomingMessage/Vercel response contract, not Next.js request.json(). */
export function createBlobUploadHandler({ env = process.env, getDatabase: database = getDatabase, head = blobHead } = {}) {
  return async (request, response) => {
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    if (request.method !== 'POST') {
      response.setHeader('Allow', 'POST');
      return response.status(405).json({ detail: 'Metodă nepermisă.' });
    }
    let callback = false;
    try {
      const body = await readBody(request);
      if (!body || !['blob.generate-client-token', 'blob.upload-completed', 'fireartro.reconcile-pending'].includes(body.type)) bad();
      if (body.type === 'fireartro.reconcile-pending') {
        const mediaId = body.payload?.mediaId;
        if (!MEDIA_ID.test(mediaId || '')) bad();
        const origin = configuredOrigin(env);
        const db = await database();
        await requireAdminUploadSession(request, header(request, 'x-csrf-token'), { db, env });
        const collection = db.collection('cms_media');
        const pending = await collection.findOne({ _id: mediaId });
        if (!pending) throw new UploadError(404, 'Încărcarea nu mai există.');
        if (pending.state === 'ready') return response.status(200).json({ id: mediaId, state: 'ready' });
        if (pending.state !== 'pending') throw new UploadError(409, 'Încărcarea nu mai poate fi confirmată.');
        const expectedUrl = `${origin}/${pending.pathname}`;
        let info;
        try { info = await head(expectedUrl, { token: env.BLOB_READ_WRITE_TOKEN }); }
        catch { throw new UploadError(409, 'Încărcarea nu a fost confirmată încă.'); }
        if (info.url !== expectedUrl || info.pathname !== pending.pathname
          || info.contentType !== pending.content_type || info.size !== pending.declared_size) bad();
        const saved = await collection.updateOne({ _id: mediaId, state: 'pending' }, { $set: {
          url: info.url, content_type: info.contentType, size: info.size,
          etag: info.etag || null, state: 'ready', completed_at: new Date(),
        } });
        if (!saved.matchedCount) {
          const current = await collection.findOne({ _id: mediaId });
          if (!current || current.state !== 'ready') throw new UploadError(409, 'Încărcarea nu mai poate fi confirmată.');
        }
        return response.status(200).json({ id: mediaId, state: 'ready' });
      }
      callback = body.type === 'blob.upload-completed';
      if (callback && !/^[0-9a-f]{64}$/i.test(header(request, 'x-vercel-signature'))) bad();
      const origin = configuredOrigin(env);
      let db, identity, metadata;
      if (!callback) {
        const input = body.payload;
        if (!input || typeof input.clientPayload !== 'string') bad();
        const payload = json(input.clientPayload);
        metadata = validateUpload(input.pathname, payload, input.multipart);
        db = await database();
        identity = await requireAdminUploadSession(request, payload.csrfToken, { db, env });
      }
      const result = await handleUpload({
        request, body, token: env.BLOB_READ_WRITE_TOKEN,
        onBeforeGenerateToken: async () => {
          const nonce = randomBytes(24).toString('hex');
          const validUntil = Math.min(Date.now() + 3_600_000, identity.expiresAt.getTime());
          await db.collection('cms_media').insertOne({
            _id: metadata.id, ...metadata, nonce, state: 'pending',
            created_by: identity.username, created_at: new Date(), token_expires_at: new Date(validUntil),
          });
          return {
            allowedContentTypes: [metadata.content_type], maximumSizeInBytes: metadata.declared_size,
            // UUID directory is already random; one token must not create several blobs.
            addRandomSuffix: false, allowOverwrite: false, validUntil,
            callbackUrl: `${requestOrigin(request, env)}/api/admin/blob-upload`,
            tokenPayload: JSON.stringify({ mediaId: metadata.id, nonce }),
          };
        },
        onUploadCompleted: async ({ blob, tokenPayload }) => {
          // Only the official SDK's verified HMAC callback can reach this branch.
          const claim = json(tokenPayload);
          if (!claim || !MEDIA_ID.test(claim.mediaId) || typeof claim.nonce !== 'string') bad();
          const collection = (await database()).collection('cms_media');
          const pending = await collection.findOne({ _id: claim.mediaId });
          if (!pending || pending.nonce !== claim.nonce || !blob
            || blob.pathname !== pending.pathname || blob.url !== `${origin}/${pending.pathname}`
            || blob.contentType !== pending.content_type) bad();
          // Retried/late webhooks must never reset edited metadata or revive deletions.
          if (pending.state !== 'pending') return;
          const info = await head(blob.url, { token: env.BLOB_READ_WRITE_TOKEN });
          if (info.url !== blob.url || info.pathname !== pending.pathname
            || info.contentType !== pending.content_type || info.size !== pending.declared_size) bad();
          await collection.updateOne({ _id: pending.id, state: 'pending' }, { $set: {
            url: info.url, content_type: info.contentType, size: info.size,
            etag: info.etag || null, state: 'ready', completed_at: new Date(),
          } });
        },
      });
      return response.status(200).json(result);
    } catch (error) {
      const status = error instanceof UploadError ? error.status : error?.code === 11000 ? 409
        : error?.name === 'BlobError' ? 400 : 503;
      return response.status(status).json({ detail: error instanceof UploadError ? error.message
        : callback ? 'Confirmarea încărcării nu a putut fi procesată.' : 'Încărcarea nu este disponibilă momentan.' });
    }
  };
}

export default createBlobUploadHandler();
