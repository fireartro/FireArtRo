import { fetchPublishedContent } from './contentApi';
const original = global.fetch;
afterEach(() => { global.fetch = original; delete window.__fireartContentBoot; });
test('loads only same-origin published content and handles revalidation', async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ revision_id: 'r1' }) });
  expect(await fetchPublishedContent()).toEqual({ revision_id: 'r1' });
  expect(global.fetch).toHaveBeenCalledWith('/api/content', expect.objectContaining({ cache: 'no-cache', credentials: 'omit' }));
  global.fetch.mockResolvedValue({ status: 304 });
  expect(await fetchPublishedContent({ revisionId: 'r1' })).toBeNull();
  expect(global.fetch.mock.calls[1][1].headers['If-None-Match']).toBe('"r1"');
});

test('consumes the early anonymous published request once, then revalidates normally', async () => {
  const publication = { revision_id: 'published-2', published_at: '2026-09-09T10:00:00Z', content: {} };
  window.__fireartContentBoot = { startedAt: Date.now(), request: Promise.resolve(publication) };
  global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 304 });
  expect(await fetchPublishedContent()).toEqual(publication);
  expect(global.fetch).not.toHaveBeenCalled();
  expect(window.__fireartContentBoot).toBeUndefined();
  expect(await fetchPublishedContent({ revisionId: 'published-2' })).toBeNull();
  expect(global.fetch).toHaveBeenCalledTimes(1);
});

test('does not reuse stale early content or swallow a failed early request', async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ revision_id: 'fresh' }) });
  window.__fireartContentBoot = { startedAt: Date.now() - 60_000, request: Promise.resolve({ revision_id: 'stale' }) };
  expect(await fetchPublishedContent()).toEqual({ revision_id: 'fresh' });
  window.__fireartContentBoot = { startedAt: Date.now(), request: Promise.resolve(null) };
  expect(await fetchPublishedContent()).toEqual({ revision_id: 'fresh' });
});

test('ignores a prefetched result after its consumer is aborted', async () => {
  let finish;
  window.__fireartContentBoot = { startedAt: Date.now(), request: new Promise(resolve => { finish = resolve; }) };
  const controller = new AbortController();
  const pending = fetchPublishedContent({ signal: controller.signal });
  controller.abort();
  finish({ revision_id: 'old-request' });
  await expect(pending).rejects.toHaveProperty('name', 'AbortError');
});
