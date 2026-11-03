const { test } = require('node:test');
const assert = require('node:assert/strict');
const createCache = require('../frontend/src/lib/heroDownloadCache');

const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return {promise,resolve}; };
const tick = () => new Promise(resolve => setImmediate(resolve));

test('requires the complete first body and downloads later chapters one at a time after playback starts', async () => {
  const bodies = [deferred(), deferred(), deferred()];
  const requests = [], revoked = [];
  const cache = createCache({fetchMedia: async src => {
    requests.push(src);
    return {status:200,headers:{get:()=> 'video/mp4'},blob:()=> bodies[Number(src[1])-1].promise};
  },createObjectURL:blob=>'blob:'+blob.id,revokeObjectURL:src=>revoked.push(src)});
  const first = cache.prepare(['/1.mp4','/2.mp4','/3.mp4']);
  await tick();
  assert.deepEqual(requests,['/1.mp4']);
  assert.equal(cache.get('/1.mp4').status,'loading');
  assert.equal(cache.get('/1.mp4').url,undefined);
  bodies[0].resolve({size:100,id:1});
  assert.equal(await first,'blob:1');
  assert.equal(cache.get('/1.mp4').status,'ready');
  await tick();
  assert.deepEqual(requests,['/1.mp4']);
  cache.preloadFollowing(0);
  await tick();
  assert.deepEqual(requests,['/1.mp4','/2.mp4']);
  cache.preloadFollowing(0);
  assert.equal(await cache.prepare(['/1.mp4','/2.mp4','/3.mp4']),'blob:1');
  bodies[1].resolve({size:100,id:2});
  await tick();
  assert.deepEqual(requests,['/1.mp4','/2.mp4','/3.mp4']);
  assert.equal(cache.get('/3.mp4').status,'loading');
  bodies[2].resolve({size:100,id:3});
  await tick();
  assert.equal(cache.get('/3.mp4').url,'blob:3');
  cache.clear();
  assert.deepEqual(revoked,['blob:1','blob:2','blob:3']);
});

test('does not advance the queue after a failed chapter and retries that chapter first', async () => {
  const requests=[],timers=[];
  let failed=false;
  const cache=createCache({fetchMedia:async src=>{
    requests.push(src);
    if(src==='/2.mp4'&&!failed){failed=true;throw new Error('offline');}
    return {status:200,headers:{get:()=> 'video/mp4'},blob:async()=>({size:100,id:src})};
  },createObjectURL:blob=>'blob:'+blob.id,revokeObjectURL:()=>{},setTimeout:fn=>{timers.push(fn);return timers.length;},clearTimeout:()=>{}});
  await cache.prepare(['/1.mp4','/2.mp4','/3.mp4']);
  cache.preloadFollowing(0);
  await tick();
  assert.deepEqual(requests,['/1.mp4','/2.mp4']);
  assert.equal(cache.get('/2.mp4').status,'error');
  timers.shift()();
  await tick();
  assert.deepEqual(requests,['/1.mp4','/2.mp4','/2.mp4','/3.mp4']);
  cache.clear();
});

test('clearing a pending playlist prevents its late body from becoming playable', async () => {
  const body=deferred(),created=[];
  const cache=createCache({fetchMedia:async()=>({status:200,headers:{get:()=> 'video/mp4'},blob:()=>body.promise}),createObjectURL:blob=>{created.push(blob);return 'blob:late';},revokeObjectURL:()=>{}});
  const pending=cache.prepare(['/1.mp4','/2.mp4','/3.mp4']).catch(error=>error.name);
  await tick();cache.clear();body.resolve({size:100});await tick();
  assert.equal(await pending,'AbortError');assert.equal(created.length,0);
});

test('a partial HTTP response or truncated file never becomes a playable chapter', async () => {
  for (const status of [206,200]) {
    const created=[];let requestSignal;
    const cache=createCache({fetchMedia:async(src,options)=>{requestSignal=options.signal;return {status,headers:{get:key=>key==='content-length'?'100':'video/mp4'},blob:async()=>({size:50})};},createObjectURL:blob=>{created.push(blob);return 'blob:partial';},revokeObjectURL:()=>{},setTimeout:()=>1,clearTimeout:()=>{}});
    const pending=cache.prepare(['/1.mp4','/2.mp4','/3.mp4']).catch(error=>error.name);
    await tick();assert.equal(cache.get('/1.mp4').status,'error');assert.equal(created.length,0);
    assert.equal(requestSignal.aborted,true);
    cache.clear();assert.equal(await pending,'AbortError');
  }
});

test('a decoder rejection evicts its completed Blob and fetches fresh full bytes', async () => {
  const requests=[],revoked=[];let count=0;
  const cache=createCache({fetchMedia:async(src,options)=>{requests.push({src,cache:options.cache});return {status:200,headers:{get:()=> 'video/mp4'},blob:async()=>({size:100,id:++count})};},createObjectURL:blob=>'blob:'+blob.id,revokeObjectURL:src=>revoked.push(src)});
  assert.equal(await cache.prepare(['/1.mp4','/2.mp4','/3.mp4']),'blob:1');
  assert.equal(await cache.reload('/1.mp4'),'blob:2');
  assert.deepEqual(revoked,['blob:1']);assert.equal(requests.length,2);
  assert.equal(requests[1].cache,'reload');
  assert.equal(cache.get('/1.mp4').url,'blob:2');cache.clear();
});

test('the early browser cache is generated from the same implementation tested by Node', () => {
  const fs=require('node:fs');const path=require('node:path');
  assert.equal(fs.readFileSync(path.resolve(__dirname,'../frontend/public/hero-download-cache.js'),'utf8'),fs.readFileSync(path.resolve(__dirname,'../frontend/src/lib/heroDownloadCache.js'),'utf8'));
  const html=fs.readFileSync(path.resolve(__dirname,'../frontend/public/index.html'),'utf8');
  assert.ok(html.indexOf('/hero-download-cache.js')<html.indexOf('/startup-intro.js'));
});
