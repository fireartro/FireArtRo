import test from 'node:test';
import assert from 'node:assert/strict';
import { createPublicPageHandler } from '../serverless/lib/public-page-handler.js';
import { publicPageDocument } from '../serverless/lib/public-page-document.js';

const template = '<!doctype html><html lang="ro"><head><title>Old</title><meta name="description" content="Old"><meta name="robots" content="index"><link rel="canonical" href="https://fireart.ro/"><meta property="og:title" content="Old"><script id="page-structured-data" type="application/ld+json">{"old":true}</script></head><body><div id="fireart-intro">Loading</div><div id="root"></div><script defer src="/static/js/main.js"></script></body></html>';
const result = { pathname: '/pachete', html: '<main><h1>Pachete</h1><a href="/contact">Contact</a></main>', meta: {title: 'Pachete & oferte', description: 'Descriere "corectă"', path: '/pachete', schema: {'@context':'https://schema.org','@type':'Service', name:'Pachete'}}, data:{publication:{revision_id:'public',content:{text:'</script><script>alert(1)</script>'}}} };
const response = () => ({headers:{},setHeader(k,v){this.headers[k.toLowerCase()]=v;},status(n){this.statusCode=n;return this;},end(body){this.body=body;},send(body){this.body=body;}});

test('warms only the selected route scripts without executing or duplicating them', async () => {
  const handler = createPublicPageHandler({ readData: async () => ({}), render: async () => result,
    readTemplate: async () => template, readAssets: async () => ({ routeScripts: {
      '/pachete': ['/static/js/packages.abc123.chunk.js', '/static/js/packages.abc123.chunk.js'],
      '/galerie': ['/static/js/gallery.def456.chunk.js'],
    } }) });
  const res = response(); await handler({method:'GET',url:'/pachete',headers:{}},res);
  assert.equal(res.statusCode, 200);
  assert.equal((res.body.match(/href="\/static\/js\/packages.abc123.chunk.js"/g) || []).length, 1);
  assert.match(res.body, /rel="preload" as="script"[^>]*fetchpriority="low"/);
  assert.doesNotMatch(res.body, /gallery.def456|src="\/static\/js\/packages/);
});

test('script preloads cannot target external or traversing paths', () => {
  for (const script of ['https://evil.test/code.js', '/static/js/../private.js', '/api/admin.js']) {
    assert.throws(() => publicPageDocument(template, result, {scripts:[script]}), /Invalid public script/);
  }
});

test('inlines trusted compiled CSS in cascade order and marks it loaded for the client runtime', () => {
  const source = template.replace('</head>', '<link rel="stylesheet" href="/static/css/main.css"></head>');
  const html = publicPageDocument(source, result, {styles:['/static/css/main.css','/static/css/route.css'],
    inlineStyles:{'/static/css/main.css':'body{margin:0}', '/static/css/route.css':'.page{color:white}'}});
  assert.ok(html.includes('<style data-href="/static/css/main.css">body{margin:0}</style>'));
  assert.ok(html.includes('<style data-href="/static/css/route.css">.page{color:white}</style>'));
  assert.ok(html.indexOf('body{margin:0}') < html.indexOf('.page{color:white}'));
  assert.equal(html.includes('rel="stylesheet"'), false);
});

test('the document exposes route content, canonical and escaped inert data under the existing CSP', () => {
  const html=publicPageDocument(template,result,{styles:['/static/css/route.css']});
  assert.match(html, /<h1>Pachete<\/h1>/);
  assert.match(html, /<title>Pachete &amp; oferte<\/title>/);
  assert.match(html, /rel="canonical" href="https:\/\/fireart.ro\/pachete"/);
  assert.match(html, /id="fireart-public-page-data" type="application\/json"/);
  assert.doesNotMatch(html, /<script>alert/);
  assert.doesNotMatch(html, /"old":true/);
  assert.match(html, /href="\/static\/css\/route.css"/);
  assert.match(html, /defer src="\/static\/js\/main.js"/);
});

test('GET and HEAD render current published data without storing a shared response cache', async () => {
  let reads=0;
  const handler=createPublicPageHandler({readData:async()=>({revision:++reads}),render:async(url,data)=>({...result,html:`<h1>Revision ${data.revision}</h1>`}),readTemplate:async()=>template,readAssets:async()=>({})});
  const first=response();await handler({method:'GET',url:'/pachete?categorie=x',headers:{}},first);
  const second=response();await handler({method:'GET',url:'/pachete',headers:{}},second);
  assert.equal(first.statusCode,200);assert.match(first.body,/Revision 1/);assert.match(second.body,/Revision 2/);
  assert.equal(first.headers['cache-control'],'no-store');
  const head=response();await handler({method:'HEAD',url:'/pachete',headers:{}},head);assert.equal(head.statusCode,200);assert.equal(head.body,undefined);
});

test('unavailable, missing pages and wrong methods preserve truthful status without private details', async () => {
  const handler=createPublicPageHandler({readData:async()=>{throw Object.assign(new Error('mongodb://private'),{status:503});},render:async()=>result,readTemplate:async()=>template,readAssets:async()=>({})});
  const unavailable=response();await handler({method:'GET',url:'/pachete',headers:{}},unavailable);
  assert.equal(unavailable.statusCode,503);assert.doesNotMatch(unavailable.body,/mongodb|private/);assert.match(unavailable.headers['x-robots-tag'],/noindex/);
  const missing=response();await handler({method:'GET',url:'/unrecognised',headers:{}},missing);assert.equal(missing.statusCode,404);
  const post=response();await handler({method:'POST',url:'/contact',headers:{}},post);assert.equal(post.statusCode,405);
});

test('private, asset and unsafe paths never invoke public data reads', async () => {
  let reads=0;
  const handler=createPublicPageHandler({readData:async()=>{reads++;return{};},render:async()=>result,readTemplate:async()=>template,readAssets:async()=>({})});
  for(const url of ['/api/page','/admin','/static/js/missing.js','//evil.test','/blog/%2fadmin','/pachete%00']) {
    const res=response();await handler({method:'GET',url,headers:{}},res);assert.equal(res.statusCode,404,url);
  }
  assert.equal(reads,0);
});

test('trailing slashes use a permanent relative redirect and do not trust Host', async()=>{
  const handler=createPublicPageHandler({readData:async()=>({}),render:async()=>result,readTemplate:async()=>template,readAssets:async()=>({})});
  const res=response();await handler({method:'GET',url:'/pachete/?categorie=x',headers:{host:'evil.test'}},res);
  assert.equal(res.statusCode,308);assert.equal(res.headers.location,'/pachete?categorie=x');
});

test('internal Vercel rewrites render the original public route without leaking routing or arbitrary query data', async () => {
  const calls = [];
  const handler = createPublicPageHandler({
    readData: async pathname => { calls.push(['read', pathname]); return {}; },
    render: async url => { calls.push(['render', url]); return result; },
    readTemplate: async () => template,
    readAssets: async () => ({ common: ['/static/css/common.css'], routes: { '/pachete': ['/static/css/packages.css'] } }),
  });
  const res = response();
  await handler({ method: 'GET', url: '/api/page?__fireart_path=%2Fpachete&categorie=Artificii%20de%20zi&private_tracking=secret', headers: { host: 'evil.test' } }, res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(calls, [['read', '/pachete'], ['render', '/pachete?categorie=Artificii+de+zi']]);
  assert.doesNotMatch(res.body, /private_tracking|secret|__fireart_path|evil\.test|fireart\.ro\/api\/page/);
  assert.match(res.body, /href="\/static\/css\/packages.css"/);
  assert.match(res.body, /href="\/static\/css\/common.css"/);
});

test('internal paths cannot be duplicated or target private, traversing or query-bearing paths', async () => {
  let reads = 0;
  const handler = createPublicPageHandler({ readData: async () => { reads++; return {}; },
    render: async () => result, readTemplate: async () => template, readAssets: async () => ({}) });
  for (const url of ['/api/page?__fireart_path=%2Fadmin', '/api/page?__fireart_path=//evil.test',
    '/api/page?__fireart_path=%2Fpachete&__fireart_path=%2Fcontact',
    '/api/page?__fireart_path=%2Fblog%2F..%2Fadmin',
    '/api/page?__fireart_path=%2Fpachete%3Fsecret%3Dvalue']) {
    const res = response();
    await handler({ method: 'GET', url, headers: {} }, res);
    assert.equal(res.statusCode, 404, url);
  }
  assert.equal(reads, 0);
});

test('ordinary paths remain authoritative when a runtime exposes source URLs with internal query data', async () => {
  const calls = [];
  const handler = createPublicPageHandler({ readData: async pathname => { calls.push(['read', pathname]); return {}; },
    render: async pathname => { calls.push(['render', pathname]); return { ...result, pathname, meta: { ...result.meta, path: pathname } }; },
    readTemplate: async () => template, readAssets: async () => ({}) });
  const res = response();
  await handler({ method: 'GET', url: '/contact?__fireart_path=%2Fpachete&publicPath=pachete', headers: {} }, res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(calls, [['read', '/contact'], ['render', '/contact']]);
  assert.match(res.body, /rel="canonical" href="https:\/\/fireart.ro\/contact"/);
  assert.doesNotMatch(res.body, /__fireart_path|publicPath=/);
  const redirect = response();
  await handler({ method: 'GET', url: '/contact/?__fireart_path=%2Fpachete&categorie=x', headers: {} }, redirect);
  assert.equal(redirect.statusCode, 308);
  assert.equal(redirect.headers.location, '/contact?categorie=x');
});

test('internal trailing-slash redirects remove routing parameters and lead to an ordinary usable public URL', async () => {
  const handler = createPublicPageHandler({ readData: async () => ({}), render: async () => result,
    readTemplate: async () => template, readAssets: async () => ({}) });
  const redirect = response();
  await handler({ method: 'GET', url: '/api/page?__fireart_path=%2Fpachete%2F&categorie=x', headers: {} }, redirect);
  assert.equal(redirect.statusCode, 308);
  assert.equal(redirect.headers.location, '/pachete?categorie=x');
  const final = response();
  await handler({ method: 'GET', url: redirect.headers.location, headers: {} }, final);
  assert.equal(final.statusCode, 200);
});

test('boot data and structured data preserve their values without allowing script termination', () => {
  const dangerous = '</script><script src="https://evil.test/code.js"></script>&\u2028\u2029';
  const html = publicPageDocument(template, { ...result, meta: { ...result.meta, schema: { text: dangerous } }, data: { text: dangerous } });
  const boot = html.match(/<script id="fireart-public-page-data" type="application\/json">([\s\S]*?)<\/script>/)[1];
  const schema = html.match(/<script id="page-structured-data" type="application\/ld\+json">([\s\S]*?)<\/script>/)[1];
  assert.equal(JSON.parse(boot).text, dangerous);
  assert.equal(JSON.parse(schema).text, dangerous);
  assert.doesNotMatch(html, /<script src="https:\/\/evil\.test/);
  assert.doesNotMatch(boot, /[<>&\u2028\u2029]/);
  assert.match(html, /<div id="fireart-intro">Loading<\/div>/);
  assert.match(html, /<noscript><style>/);
});

test('dynamic article and service routes receive their CSS without duplicating existing stylesheet links', async () => {
  for (const [pathname, pattern] of [['/blog/public-article', '/blog/:slug'], ['/servicii/spectacole-drone', '/servicii/:slug']]) {
    const handler = createPublicPageHandler({ readData: async () => ({}), render: async () => ({ ...result, pathname, meta: { ...result.meta, path: pathname } }),
      readTemplate: async () => template.replace('</head>', '<link rel="stylesheet" href="/static/css/common.css"></head>'),
      readAssets: async () => ({ common: ['/static/css/common.css'], routes: { [pattern]: ['/static/css/details.css'] } }),
    });
    const res = response(); await handler({ method: 'GET', url: pathname, headers: {} }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.match(/href="\/static\/css\/common\.css"/g).length, 1);
    assert.match(res.body, /href="\/static\/css\/details.css"/);
  }
});

test('the handler supports native Node responses without a framework status helper', async () => {
  const handler = createPublicPageHandler({ readData: async () => ({}), render: async () => result,
    readTemplate: async () => template, readAssets: async () => ({}) });
  const native = { headers: {}, setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
    end(body) { this.body = body; } };
  await handler({ method: 'GET', url: '/pachete', headers: {} }, native);
  assert.equal(native.statusCode, 200);
  assert.match(native.body, /<h1>Pachete<\/h1>/);
});

test('legacy legal page aliases redirect permanently without querying public content', async () => {
  let reads = 0;
  const handler = createPublicPageHandler({ readData: async () => { reads++; return {}; }, render: async () => result,
    readTemplate: async () => template, readAssets: async () => ({}) });
  for (const [source, destination] of [['/legal/confidentialitate', '/confidentialitate'],
    ['/legal/termeni', '/termeni-si-conditii'], ['/legal/cookies', '/cookies']]) {
    for (const internal of [false, true]) {
      const url = internal ? `/api/page?__fireart_path=${encodeURIComponent(`${source}/`)}&campaign=old`
        : `${source}?campaign=old`;
      const res = response(); await handler({ method: 'GET', url, headers: { host: 'evil.test' } }, res);
      assert.equal(res.statusCode, 308, url);
      assert.equal(res.headers.location, `${destination}?campaign=old`, url);
    }
  }
  assert.equal(reads, 0);
});
