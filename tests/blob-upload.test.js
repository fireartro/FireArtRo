import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { getPayloadFromClientToken } from '@vercel/blob/client';
import { test } from 'node:test';
import { createBlobUploadHandler } from '../api/admin/blob-upload.js';
import { hashToken, requireAdminUploadSession } from '../serverless/lib/admin-session.js';
import { resolveMongoUri } from '../serverless/lib/mongodb.js';

const env = {
  ADMIN_USERNAME: 'administrator', ADMIN_SESSION_SECRET: 'local-test-secret'.repeat(3),
  BLOB_READ_WRITE_TOKEN: 'vercel_blob_rw_localtest_' + 'x'.repeat(32),
  VERCEL_BLOB_MEDIA_ORIGIN: 'https://localtest.public.blob.vercel-storage.com',
};
const cookie = 'a'.repeat(64);
// Independent fixture uses Python's documented domain-separated CSRF construction.
const csrf = createHmac('sha256', env.ADMIN_SESSION_SECRET)
  .update('fireartro:admin-csrf:v1\0' + cookie).digest('base64url');
const hash = (value) => createHmac('sha256', env.ADMIN_SESSION_SECRET).update(value).digest('hex');
const id = 'media-11111111-1111-4111-8111-111111111111';
const pathname = `cms/${id}/asset.webp`;
const url = `${env.VERCEL_BLOB_MEDIA_ORIGIN}/${pathname}`;

test('MongoDB connection accepts the secret name created by the Vercel Atlas integration', () => {
  assert.equal(resolveMongoUri({ MONGO_MONGODB_URI: 'mongodb+srv://atlas.example' }), 'mongodb+srv://atlas.example');
  assert.equal(resolveMongoUri({ MONGODB_URI: 'primary', MONGO_MONGODB_URI: 'integration', MONGO_URL: 'legacy' }), 'primary');
});

function fixture() {
  const records = new Map();
  const session = { token_hash: hash(cookie), csrf_hash: hash(csrf),
    expires_at: new Date(Date.now() + 3_600_000), revoked_at: null };
  const db = { collection(name) {
    if (name === 'admin_sessions') return { async findOne(query) {
      return query.token_hash === session.token_hash ? session : null;
    } };
    assert.equal(name, 'cms_media');
    return {
      async insertOne(doc) {
        if (records.has(doc._id)) throw Object.assign(new Error('duplicate'), { code: 11000 });
        records.set(doc._id, structuredClone(doc));
      },
      async findOne(query) { return structuredClone(records.get(query._id) || null); },
      async updateOne(query, update) {
        const doc = records.get(query._id);
        if (!doc || (query.state && doc.state !== query.state)) return { matchedCount: 0 };
        Object.assign(doc, update.$set);
        return { matchedCount: 1 };
      },
    };
  } };
  let heads = 0;
  const handler = createBlobUploadHandler({ env, getDatabase: async () => db,
    head: async () => { heads++; return { url, pathname, size: 1200, contentType: 'image/webp', etag: 'etag' }; } });
  const payload = { mediaId: id, csrfToken: csrf, contentType: 'image/webp', size: 1200, filename: 'Cer.webp' };
  function request(body, headers = {}) {
    return { method: 'POST', url: '/api/admin/blob-upload', socket: {}, body,
      headers: { host: 'localhost:3000', origin: 'http://localhost:3000',
        cookie: `fireartro_admin_session=${cookie}`, 'content-type': 'application/json', ...headers } };
  }
  async function call(body, headers) {
    let status, output;
    const response = { setHeader() {}, status(code) { status = code; return this; }, json(value) { output = value; return this; } };
    await handler(request(body, headers), response);
    return { status, output };
  }
  const generate = (changes = {}) => ({ type: 'blob.generate-client-token', payload: {
    pathname, multipart: false, clientPayload: JSON.stringify({ ...payload, ...changes }),
  } });
  return { db, records, session, request, call, generate, heads: () => heads };
}

test('Node shares the Python HMAC and derives admin identity only from server configuration', async () => {
  assert.equal(hashToken('test', 'secret'), '0329a06b62cd16b33eb6792be8c60b158d89a2ee3a876fce9a881ebb488c0914');
  const f = fixture();
  const identity = await requireAdminUploadSession(f.request({}), csrf, { db: f.db, env });
  assert.equal(identity.username, 'administrator');
});

test('missing cookie, wrong CSRF, expired/revoked session, and hostile origin never mint tokens', async () => {
  for (const variant of ['cookie', 'csrf', 'expired', 'revoked', 'origin', 'fetch-site', 'forwarded-host']) {
    const f = fixture();
    if (variant === 'expired') f.session.expires_at = new Date(0);
    if (variant === 'revoked') f.session.revoked_at = new Date();
    const headers = {
      cookie: variant === 'cookie' ? '' : `fireartro_admin_session=${cookie}`,
      ...(variant === 'origin' ? { origin: 'https://evil.example' } : {}),
      ...(variant === 'fetch-site' ? { 'sec-fetch-site': 'same-site' } : {}),
      ...(variant === 'forwarded-host' ? { origin: 'https://evil.example', 'x-forwarded-host': 'evil.example' } : {}),
    };
    const result = await f.call(f.generate(variant === 'csrf' ? { csrfToken: 'b'.repeat(43) } : {}), headers);
    assert.ok([401, 403].includes(result.status), variant);
    assert.equal(f.records.size, 0);
  }
});

test('MIME, bytes and traversal are constrained before any pending record is created', async () => {
  for (const changes of [{ contentType: 'image/svg+xml' }, { size: 8 * 1024 * 1024 + 1 },
    { size: 0 }, { size: '1200' }, { mediaId: '../escape' }, { width: -1 }]) {
    const f = fixture();
    assert.equal((await f.call(f.generate(changes))).status, 400);
    assert.equal(f.records.size, 0);
  }
  const f = fixture();
  const body = f.generate(); body.payload.pathname = 'cms/../asset.webp';
  assert.equal((await f.call(body)).status, 400);
});

test('real SDK generates constrained token and pending record without a Blob connection', async () => {
  const f = fixture();
  const response = await f.call(f.generate({ adminId: 'attacker' }));
  assert.equal(response.status, 200);
  assert.equal(response.output.type, 'blob.generate-client-token');
  const token = getPayloadFromClientToken(response.output.clientToken);
  assert.deepEqual(token.allowedContentTypes, ['image/webp']);
  assert.equal(token.maximumSizeInBytes, 1200);
  assert.equal(token.allowOverwrite, false);
  assert.equal(token.pathname, pathname);
  assert.ok(token.validUntil <= f.session.expires_at.getTime());
  assert.equal(f.records.get(id).created_by, 'administrator');
  assert.equal(f.records.get(id).state, 'pending');
});

async function completed(f, mutate = (body) => body, signed = true) {
  const pending = f.records.get(id);
  const body = mutate({ type: 'blob.upload-completed', payload: {
    blob: { url, pathname, contentType: 'image/webp', downloadUrl: `${url}?download=1` },
    tokenPayload: JSON.stringify({ mediaId: id, nonce: pending.nonce }),
  } });
  const signature = createHmac('sha256', env.BLOB_READ_WRITE_TOKEN).update(JSON.stringify(body)).digest('hex');
  return f.call(body, { cookie: '', origin: '', 'x-vercel-signature': signed ? signature : 'bad' });
}

test('unsigned callbacks cannot persist and signed callbacks use HEAD and are idempotent', async () => {
  const f = fixture();
  await f.call(f.generate());
  assert.equal((await completed(f, undefined, false)).status, 400);
  assert.equal(f.heads(), 0);
  assert.equal(f.records.get(id).state, 'pending');
  assert.equal((await completed(f)).status, 200);
  assert.equal(f.records.get(id).size, 1200);
  assert.equal(f.records.get(id).state, 'ready');
  f.records.get(id).alt_text = 'Edited after upload';
  assert.equal((await completed(f)).status, 200);
  assert.equal(f.records.get(id).alt_text, 'Edited after upload');
  f.records.get(id).state = 'deleted';
  assert.equal((await completed(f)).status, 200);
  assert.equal(f.records.get(id).state, 'deleted');
});

test('even signed callbacks cannot redirect HEAD to another host or use another nonce', async () => {
  const f = fixture(); await f.call(f.generate());
  for (const mutation of [
    (body) => { body.payload.blob.url = 'http://127.0.0.1/secret'; return body; },
    (body) => { body.payload.tokenPayload = JSON.stringify({ mediaId: id, nonce: 'wrong' }); return body; },
  ]) assert.equal((await completed(f, mutation)).status, 400);
  assert.equal(f.heads(), 0);
});

test('an authenticated operator can reconcile a late Blob callback without creating a second upload', async () => {
  const f = fixture();
  await f.call(f.generate());
  const body = { type: 'fireartro.reconcile-pending', payload: { mediaId: id } };

  const first = await f.call(body, { 'x-csrf-token': csrf });
  assert.equal(first.status, 200);
  assert.deepEqual(first.output, { id, state: 'ready' });
  assert.equal(f.records.get(id).state, 'ready');
  assert.equal(f.heads(), 1);

  const again = await f.call(body, { 'x-csrf-token': csrf });
  assert.equal(again.status, 200);
  assert.equal(f.heads(), 1);
});
