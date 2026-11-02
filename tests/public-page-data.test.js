import assert from 'node:assert/strict';
import test from 'node:test';
import { createPublicPageDataReader, PublicPageDataError } from '../serverless/lib/public-page-data.js';

const publication = () => ({
  _id: 'mongo-private', id: 'current', revision_id: 'revision-public',
  published_at: new Date('2026-11-02T12:00:00Z'), published_by: 'private-admin',
  content: { schema_version: 1, siteDetails: { name: 'Published FireArtRo' }, mediaItems: [] },
});
const article = (id, status = 'published') => ({
  _id: `mongo-${id}`, id, slug: id, title: `Event ${id}`, excerpt: 'Published excerpt',
  body: 'Published article body', category: 'Evenimente', cover_media_id: '', cover_alt: '',
  status, created_at: '2026-10-01T00:00:00Z', updated_at: '2026-11-01T00:00:00Z',
  published_at: '2026-10-02T00:00:00Z', version: 2,
  internal_notes: 'private-notes', author_email: 'private@example.invalid',
});

function fixture({ current = publication(), articles = [article('published-event'), article('draft-event', 'draft')] } = {}) {
  const queries = [];
  const collections = [];
  const db = { collection(name) {
    collections.push(name);
    if (name === 'site_content_publications') return {
      async findOne(query, options) {
        queries.push({ collection: name, query, options });
        return structuredClone(current);
      },
    };
    assert.equal(name, 'blog_posts', 'No draft, admin, customer or media collections may be read');
    return {
      async findOne(query, options) {
        queries.push({ collection: name, query, options });
        return structuredClone(articles.find(item => item.slug === query.slug && item.status === query.status) || null);
      },
      find(query, options) {
        const record = { collection: name, query, options };
        queries.push(record);
        let limit;
        return {
          sort(value) { record.sort = value; return this; },
          limit(value) { limit = value; record.limit = value; return this; },
          maxTimeMS(value) { record.maxTimeMS = value; return this; },
          async toArray() {
            return structuredClone(articles.filter(item => item.status === query.status)
              .sort((a, b) => b.published_at.localeCompare(a.published_at)).slice(0, limit));
          },
        };
      },
    };
  } };
  return { read: createPublicPageDataReader({ getDatabase: async () => db }), queries, collections };
}

test('returns the current public snapshot without administrative publication metadata', async () => {
  const f = fixture();
  const result = await f.read('/pachete?categorie=Efecte%20speciale');
  assert.deepEqual(result, {
    publication: { revision_id: 'revision-public', published_at: '2026-11-02T12:00:00.000Z', content: publication().content },
    posts: [], post: null,
  });
  assert.deepEqual(f.collections, ['site_content_publications']);
  assert.deepEqual(f.queries[0].query, { id: 'current' });
  assert.deepEqual(f.queries[0].options.projection, { _id: 0, revision_id: 1, published_at: 1, content: 1 });
  assert.ok(f.queries[0].options.maxTimeMS > 0);
  assert.doesNotMatch(JSON.stringify(result), /mongo-private|private-admin|published_by/);
});

test('reads each publication afresh so the next request sees an Admin publication', async () => {
  let revision = 0;
  const read = createPublicPageDataReader({ getDatabase: async () => ({ collection: () => ({
    findOne: async () => ({ ...publication(), revision_id: `revision-${++revision}` }),
  }) }) });
  assert.equal((await read('/contact')).publication.revision_id, 'revision-1');
  assert.equal((await read('/contact')).publication.revision_id, 'revision-2');
});

test('homepage requests only the three newest published summaries with public fields', async () => {
  const f = fixture({ articles: [article('one'), article('two'), article('three'), article('four'), article('draft', 'draft')] });
  const result = await f.read('/');
  assert.equal(result.posts.length, 3);
  assert.equal(result.post, null);
  for (const post of result.posts) {
    assert.deepEqual(Object.keys(post).sort(), [
      'id', 'slug', 'title', 'excerpt', 'category', 'cover_media_id', 'cover_alt', 'published_at', 'updated_at',
    ].sort());
    assert.doesNotMatch(JSON.stringify(post), /private|body|status|created_at|version|draft/);
  }
  const query = f.queries.find(q => q.collection === 'blog_posts');
  assert.deepEqual(query.query, { status: 'published' });
  assert.equal(query.limit, 3);
  assert.ok(query.maxTimeMS > 0);
});

test('blog archive reads a bounded list and never includes article bodies or drafts', async () => {
  const f = fixture();
  const result = await f.read('/blog');
  assert.deepEqual(result.posts.map(post => post.slug), ['published-event']);
  assert.equal(f.queries.find(q => q.collection === 'blog_posts').limit, 100);
  assert.equal(result.posts[0].body, undefined);
});

test('article rendering receives only the public article response for an exact published slug', async () => {
  const f = fixture();
  const result = await f.read('/blog/published-event');
  assert.equal(result.post.body, 'Published article body');
  assert.equal(result.post.status, 'published');
  assert.equal(result.post.version, 2);
  assert.deepEqual(result.posts, []);
  assert.doesNotMatch(JSON.stringify(result), /mongo-published-event|private-notes|private@example/);
  assert.deepEqual(f.queries.find(q => q.collection === 'blog_posts').query, {
    slug: 'published-event', status: 'published',
  });
});

test('a draft slug and a missing article have the same public 404', async () => {
  const f = fixture();
  for (const path of ['/blog/draft-event', '/blog/absent-event']) {
    await assert.rejects(f.read(path), error => error instanceof PublicPageDataError
      && error.status === 404 && error.statusCode === 404 && error.message === 'Articolul nu a fost găsit.');
  }
});

test('malformed or unsafe article paths never enter a database query', async () => {
  let calls = 0;
  const read = createPublicPageDataReader({ getDatabase: async () => { calls++; throw new Error('must not connect'); } });
  for (const path of ['https://elsewhere.invalid/blog/post', '//elsewhere.invalid/blog/post', '/blog/%2Fprivate',
    '/blog/%ZZ', '/blog/../admin', '/blog/post/extra', '/blog/$where', '/blog/post\\admin']) {
    await assert.rejects(read(path), error => error instanceof PublicPageDataError && error.status === 404);
  }
  assert.equal(calls, 0);
});

test('missing or malformed publication fails closed with a generic service error', async () => {
  for (const current of [null, { ...publication(), revision_id: '' }, { ...publication(), published_at: 'not-a-date' },
    { ...publication(), content: null }, { ...publication(), content: [] }]) {
    await assert.rejects(fixture({ current }).read('/'), error => error instanceof PublicPageDataError
      && error.status === 503 && error.message === 'Conținutul public nu este disponibil momentan.');
  }
});

test('database failures do not expose provider details or connection secrets', async () => {
  const read = createPublicPageDataReader({ getDatabase: async () => {
    throw new Error('mongodb+srv://private:secret@database.invalid');
  } });
  await assert.rejects(read('/'), error => error instanceof PublicPageDataError && error.status === 503
    && !/mongodb|secret|database.invalid/.test(`${error.message} ${JSON.stringify(error)}`));
});

test('optional summary fields receive the same empty-string defaults as the public API', async () => {
  const minimal = { id: 'minimal', slug: 'minimal', title: 'Minimal', status: 'published',
    published_at: '2026-10-02T00:00:00Z', updated_at: '2026-11-01T00:00:00Z' };
  const result = await fixture({ articles: [minimal] }).read('/blog');
  assert.deepEqual(result.posts[0], { id: 'minimal', slug: 'minimal', title: 'Minimal', excerpt: '',
    category: '', cover_media_id: '', cover_alt: '', published_at: minimal.published_at, updated_at: minimal.updated_at });
});
