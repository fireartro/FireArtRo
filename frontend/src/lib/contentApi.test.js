import { fetchPublishedContent } from './contentApi';
const original = global.fetch;
afterEach(() => { global.fetch = original; });
test('loads only same-origin published content and handles revalidation', async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ revision_id: 'r1' }) });
  expect(await fetchPublishedContent()).toEqual({ revision_id: 'r1' });
  expect(global.fetch).toHaveBeenCalledWith('/api/content', expect.objectContaining({ cache: 'no-cache', credentials: 'omit' }));
  global.fetch.mockResolvedValue({ status: 304 });
  expect(await fetchPublishedContent({ revisionId: 'r1' })).toBeNull();
  expect(global.fetch.mock.calls[1][1].headers['If-None-Match']).toBe('"r1"');
});
