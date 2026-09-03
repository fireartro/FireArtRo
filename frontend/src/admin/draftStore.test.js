import seed from '@/content/__fixtures__/siteContent.json';
import { createDraftStore } from './draftStore';

const snapshot = (content = seed, version = 2) => ({ content, version, published_revision_id: 'r1', published_at: '2026-09-03T10:00:00Z' });
const publication = () => Promise.resolve({ content: seed, revision_id: 'r1' });
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
async function ready() {
  const request = jest.fn().mockResolvedValue(snapshot());
  const store = createDraftStore(request, publication);
  await store.load();
  request.mockClear();
  return { store, request };
}
test('autosave preserves edits typed during an in-flight save and advances the server version', async () => {
  const { store, request } = await ready();
  store.update('siteDetails.name', 'First edit');
  const pending = deferred();
  request.mockReturnValueOnce(pending.promise);
  const saving = store.save();
  store.update('siteDetails.name', 'Second edit');
  expect(await store.save()).toBe(false);
  pending.resolve(snapshot({ ...seed, siteDetails: { ...seed.siteDetails, name: 'First edit' } }, 3));
  await saving;
  expect(store.getSnapshot()).toMatchObject({ status: 'dirty', dirty: true, version: 3 });
  expect(store.getSnapshot().draft.siteDetails.name).toBe('Second edit');
  expect(request.mock.calls.map(([path]) => path)).toEqual(['/api/admin/content/draft']);
});
test('a stale editor keeps its local text and cannot publish or retry over the newer draft', async () => {
  const { store, request } = await ready();
  store.update('siteDetails.name', 'Local edit');
  request.mockRejectedValue(Object.assign(new Error('Conflict'), { status: 409 }));
  await store.save();
  expect(store.getSnapshot()).toMatchObject({ status: 'conflict', dirty: true, version: 2 });
  expect(await store.publish()).toBe(false);
  expect(await store.save()).toBe(false);
  expect(request).toHaveBeenCalledTimes(1);
  expect(store.getSnapshot().draft.siteDetails.name).toBe('Local edit');
});
test('invalid fields and pending uploads block saving/publication', async () => {
  const { store, request } = await ready();
  store.update('siteDetails.email', 'bad email');
  expect(await store.save()).toBe(false);
  expect(store.getSnapshot().errors[0].path).toBe('siteDetails.email');
  expect(await store.publish()).toBe(false);
  expect(request).not.toHaveBeenCalled();
  store.update('siteDetails.email', seed.siteDetails.email);
  store.setPendingUploads(1);
  expect(await store.save()).toBe(false);
});
test('publish is explicit and a failure preserves the prior public snapshot', async () => {
  const { store, request } = await ready();
  request.mockRejectedValueOnce(new Error('Offline'));
  expect(await store.publish('Descriere')).toBe(false);
  expect(store.getSnapshot().publishedContent).toEqual(seed);
  expect(store.getSnapshot().status).toBe('error');
});
test('restoration changes only draft and sends the expected version', async () => {
  const { store, request } = await ready();
  const restored = { ...seed, siteDetails: { ...seed.siteDetails, name: 'Historical' } };
  request.mockResolvedValueOnce(snapshot(restored, 3));
  expect(await store.restoreRevision('old-revision')).toBe(true);
  expect(store.getSnapshot().draft.siteDetails.name).toBe('Historical');
  expect(store.getSnapshot().publishedContent).toEqual(seed);
  expect(JSON.parse(request.mock.calls[0][1].body)).toEqual({ version: 2 });
});
