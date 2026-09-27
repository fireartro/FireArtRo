import { watchPublications, announcePublication } from './publicationSync';
import { fetchPublishedRevision } from './contentApi';

const originalFetch = global.fetch;
let stop;
let revision;
let refresh;
const response = (id = revision) => ({ok: true, status: 200, json: async () => ({revision_id: id, published_at: '2026-09-27T10:00:00Z'})});
const tick = async time => { jest.advanceTimersByTime(time); for (let i = 0; i < 8; i++) await Promise.resolve(); };
beforeEach(() => {
  jest.useFakeTimers(); revision = 'r1';
  Object.defineProperty(document, 'visibilityState', {configurable:true, value:'visible'});
  Object.defineProperty(navigator, 'onLine', {configurable:true, value:true});
  global.fetch = jest.fn().mockImplementation(async () => response());
  refresh = jest.fn(async () => { revision = 'r2'; });
});
afterEach(() => { stop?.(); stop = null; global.fetch = originalFetch; jest.useRealTimers(); localStorage.clear(); });
const start = () => { stop = watchPublications({getRevision:()=>revision, refresh}); };

test('a changed publication refreshes without downloading unchanged full content', async () => {
  start(); await tick(5000);
  expect(refresh).not.toHaveBeenCalled();
  global.fetch.mockResolvedValue(response('r2'));
  await tick(5000);
  expect(refresh).toHaveBeenCalledTimes(1);
  expect(global.fetch.mock.calls.every(([url]) => url === '/api/content/revision')).toBe(true);
});
test('polling never overlaps a stalled request and aborts it on disposal', async () => {
  global.fetch.mockImplementation(() => new Promise(() => {}));
  start(); await tick(5000); await tick(20000);
  expect(global.fetch).toHaveBeenCalledTimes(1);
  const signal = global.fetch.mock.calls[0][1].signal;
  stop(); stop = null;
  expect(signal.aborted).toBe(true);
});
test('hidden and offline pages pause checks; returning online revalidates immediately', async () => {
  start(); Object.defineProperty(document, 'visibilityState', {value:'hidden'});
  document.dispatchEvent(new Event('visibilitychange'));
  await tick(20000); expect(global.fetch).not.toHaveBeenCalled();
  Object.defineProperty(document, 'visibilityState', {value:'visible'});
  Object.defineProperty(navigator, 'onLine', {value:false});
  document.dispatchEvent(new Event('visibilitychange'));
  await tick(5000); expect(global.fetch).not.toHaveBeenCalled();
  Object.defineProperty(navigator, 'onLine', {value:true});
  window.dispatchEvent(new Event('online')); await tick(0);
  expect(global.fetch).toHaveBeenCalledTimes(1);
});
test('failures back off, then resume normal checks after recovery', async () => {
  global.fetch.mockRejectedValue(new Error('offline'));
  start(); await tick(5000); await tick(5000);
  expect(global.fetch).toHaveBeenCalledTimes(1);
  await tick(5000); expect(global.fetch).toHaveBeenCalledTimes(2);
  global.fetch.mockResolvedValue(response('r2')); await tick(20000);
  expect(refresh).toHaveBeenCalledTimes(1);
  await tick(5000); expect(global.fetch).toHaveBeenCalledTimes(4);
});
test('same-browser notifications trigger revalidation, not trusting supplied content', async () => {
  start(); global.fetch.mockResolvedValue(response('r2'));
  window.dispatchEvent(new StorageEvent('storage', {key:'fireartro-publication', newValue:JSON.stringify({revision_id:'r2'})}));
  await tick(0); expect(refresh).toHaveBeenCalledTimes(1);
  stop(); stop = null;
  const calls = global.fetch.mock.calls.length;
  window.dispatchEvent(new Event('online')); await tick(15000);
  expect(global.fetch).toHaveBeenCalledTimes(calls);
});
test('announcements contain only a public revision, and denied storage is nonfatal', () => {
  announcePublication('r3');
  expect(JSON.parse(localStorage.getItem('fireartro-publication'))).toEqual({revision_id:'r3'});
  jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {throw new Error('denied');});
  expect(() => announcePublication('r4')).not.toThrow();
  jest.restoreAllMocks();
});
test('revision responses are conditional, anonymous and validated', async () => {
  global.fetch.mockResolvedValue(response('r2'));
  expect(await fetchPublishedRevision({revisionId:'r1'})).toHaveProperty('revision_id','r2');
  expect(global.fetch).toHaveBeenCalledWith('/api/content/revision', expect.objectContaining({credentials:'omit',cache:'no-cache',headers:{'If-None-Match':'"r1"'}}));
  global.fetch.mockResolvedValue({status:304}); expect(await fetchPublishedRevision()).toBeNull();
  global.fetch.mockResolvedValue({ok:true,status:200,json:async()=>({content:{}})});
  await expect(fetchPublishedRevision()).rejects.toThrow();
});
