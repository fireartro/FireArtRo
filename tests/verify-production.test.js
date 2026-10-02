import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { readFileSync } from "node:fs";

import { verifyProduction } from "../scripts/verify-production.mjs";


async function withServer(responses, run) {
  const requests = [];
  const server = http.createServer((request, response) => {
    requests.push({ url: request.url, headers: request.headers });
    const fixture = responses[request.url];
    const value = (typeof fixture === "function" ? fixture(request) : fixture) || {
      status: 404,
      type: "text/plain",
      body: "Not found",
    };
    response.writeHead(value.status || 200, { "content-type": value.type });
    response.end(value.body);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const previous = process.env.FIREARTRO_BASE_URL;
  process.env.FIREARTRO_BASE_URL = `http://127.0.0.1:${server.address().port}`;
  try {
    await run(requests);
  } finally {
    if (previous === undefined) delete process.env.FIREARTRO_BASE_URL;
    else process.env.FIREARTRO_BASE_URL = previous;
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}


const content = JSON.parse(readFileSync(new URL('../frontend/src/content/__fixtures__/siteContent.json', import.meta.url), 'utf8'));
const metadata = { revision_id: 'synthetic-publication-1', published_at: '2026-10-02T08:00:00Z' };
const publication = { ...metadata, content };
const json = value => ({ type: 'application/json', body: JSON.stringify(value) });
const validResponses = {
  "/": { type: "text/html", body: `<html><head>
    <script src="/site-bootstrap.js?v=synthetic"></script>
    <link href='/startup-intro.css?v=synthetic' rel='stylesheet'>
    <script defer src="/static/js/main.synthetic.js"></script>
    <link rel="stylesheet" href="/static/css/main.synthetic.css">
    </head><body><main id="root"></main></body></html>` },
  '/site-bootstrap.js?v=synthetic': { type: 'text/javascript', body: 'window.syntheticBoot = true;' },
  '/startup-intro.css?v=synthetic': { type: 'text/css', body: 'body { margin: 0; }' },
  '/static/js/main.synthetic.js': { type: 'application/javascript', body: 'window.syntheticApp = true;' },
  '/static/css/main.synthetic.css': { type: 'text/css', body: '#root { display: block; }' },
  '/api/content': json(publication),
  '/api/content/revision': json(metadata),
  "/api/health": {
    type: "application/json",
    body: JSON.stringify({
      status: "ready",
      configuration_errors: [],
      database: "ready",
      indexes: "ready",
    }),
  },
  "/api/sitemap.xml": {
    type: "application/xml",
    body: "<urlset><url><loc>https://fireart.ro/</loc></url></urlset>",
  },
  "/robots.txt": {
    type: "text/plain",
    body: "Sitemap: https://fireart.ro/api/sitemap.xml",
  },
};


test("production verifier accepts the complete public contract", async () => {
  await withServer(validResponses, async (requests) => {
    await assert.doesNotReject(verifyProduction());
    for (const url of ['/api/content', '/api/content/revision', '/static/js/main.synthetic.js', '/static/css/main.synthetic.css']) {
      const request = requests.find(request => request.url === url);
      assert.ok(request, `Critical public resource was not verified: ${url}`);
      assert.equal(request.headers.cookie, undefined);
      assert.equal(request.headers.authorization, undefined);
    }
  });
});

for (const endpoint of ['/api/content', '/api/content/revision']) {
  test(`production verifier fails for a missing anonymous publication at ${endpoint}`, async () => {
    await withServer({ ...validResponses, [endpoint]: { ...json({ detail: 'PRIVATE_PROVIDER_DIAGNOSTIC' }), status: 404 } }, async () => {
      await assert.rejects(verifyProduction(), error => {
        assert.match(error.message, /\/api\/content.*HTTP 404/);
        assert.doesNotMatch(error.message, /PRIVATE_PROVIDER_DIAGNOSTIC/);
        return true;
      });
    });
  });
  for (const value of [null, {}, { ...metadata, revision_id: '' }, { ...metadata, published_at: 'invalid' }]) {
    test(`production verifier rejects invalid publication metadata at ${endpoint}: ${JSON.stringify(value)}`, async () => {
      await withServer({ ...validResponses, [endpoint]: json(value) }, async () => {
        await assert.rejects(verifyProduction(), /publication.*invalid/i);
      });
    });
  }
  test(`production verifier sanitizes malformed publication JSON at ${endpoint}`, async () => {
    await withServer({ ...validResponses, [endpoint]: { type: 'application/json', body: '{"PRIVATE_PROVIDER_DIAGNOSTIC":' } }, async () => {
      await assert.rejects(verifyProduction(), error => {
        assert.match(error.message, /invalid JSON/i);
        assert.doesNotMatch(error.message, /PRIVATE_PROVIDER_DIAGNOSTIC/);
        return true;
      });
    });
  });
}

for (const [description, invalidContent] of [
  ['null', null], ['empty object', {}], ['array', []],
  ['missing legal pages', { ...content, legalPages: null }],
  ['invalid media collection', { ...content, mediaItems: {} }],
]) {
  test(`production verifier rejects an unusable published snapshot: ${description}`, async () => {
    await withServer({ ...validResponses, '/api/content': json({ ...metadata, content: invalidContent }) }, async () => {
      await assert.rejects(verifyProduction(), /published content.*invalid/i);
    });
  });
}

test('production verifier preserves intentionally empty published collections', async () => {
  await withServer({ ...validResponses, '/api/content': json({ ...metadata, content: {
    ...content, mediaItems: [], packages: [], faqs: [], testimonials: [], partners: [],
  } }) }, async () => { await assert.doesNotReject(verifyProduction()); });
});

test('production verifier rejects persistently inconsistent content and revision metadata', async () => {
  await withServer({ ...validResponses, '/api/content/revision': json({ ...metadata, revision_id: 'synthetic-publication-2' }) }, async () => {
    await assert.rejects(verifyProduction(), /publication.*inconsistent/i);
  });
});

test('production verifier tolerates one publication change between the anonymous reads', async () => {
  let reads = 0;
  await withServer({ ...validResponses,
    '/api/content': () => json({ ...publication, revision_id: ++reads === 1 ? metadata.revision_id : 'synthetic-publication-2' }),
    '/api/content/revision': json({ ...metadata, revision_id: 'synthetic-publication-2' }),
  }, async () => { await assert.doesNotReject(verifyProduction()); });
});

for (const asset of ['/static/js/main.synthetic.js', '/static/css/main.synthetic.css', '/site-bootstrap.js?v=synthetic', '/startup-intro.css?v=synthetic']) {
  test(`production verifier fails for a missing referenced critical asset: ${asset}`, async () => {
    await withServer({ ...validResponses, [asset]: undefined }, async () => {
      await assert.rejects(verifyProduction(), /HTTP 404/);
    });
  });
}

test('production verifier rejects HTML served in place of a JavaScript bundle', async () => {
  await withServer({ ...validResponses, '/static/js/main.synthetic.js': { type: 'text/html', body: '<main id="root"></main>' } }, async () => {
    await assert.rejects(verifyProduction(), /unexpected content type/i);
  });
});

test('production verifier rejects a bare shell even with a ready publication', async () => {
  await withServer({ ...validResponses, '/': { type: 'text/html', body: '<main id="root"></main>' } }, async () => {
    await assert.rejects(verifyProduction(), /shell.*JavaScript.*CSS/i);
  });
});

for (const body of [
  '<main id="root"></main><script src="/site-bootstrap.js?v=synthetic"></script><link rel="stylesheet" href="/startup-intro.css?v=synthetic">',
  '<main id="root"></main><script src="/static/js/main.synthetic.js"></script><link rel="stylesheet" href="/startup-intro.css?v=synthetic">',
]) {
  test('production verifier rejects startup-only references without the CRA application assets', async () => {
    await withServer({ ...validResponses, '/': { type: 'text/html', body } }, async () => {
      await assert.rejects(verifyProduction(), /shell.*JavaScript.*CSS/i);
    });
  });
}

for (const [asset, type] of [['/static/js/main.synthetic.js', 'application/javascript'], ['/static/css/main.synthetic.css', 'text/css']]) {
  test(`production verifier rejects an empty critical asset: ${asset}`, async () => {
    await withServer({ ...validResponses, [asset]: { type, body: '  ' } }, async () => {
      await assert.rejects(verifyProduction(), /asset.*empty/i);
    });
  });
}

for (const [endpoint, type, body, error] of [
  ['/api/sitemap.xml', 'application/xml', '<urlset></urlset>', /canonical homepage/i],
  ['/robots.txt', 'text/plain', 'User-agent: *', /live sitemap/i],
  ['/api/health', 'application/json', '{"PRIVATE_PROVIDER_DIAGNOSTIC":', /invalid JSON/i],
]) {
  test(`production verifier retains sanitized failure detection at ${endpoint}`, async () => {
    await withServer({ ...validResponses, [endpoint]: { type, body } }, async () => {
      await assert.rejects(verifyProduction(), failure => {
        assert.match(failure.message, error);
        assert.doesNotMatch(failure.message, /PRIVATE_PROVIDER_DIAGNOSTIC/);
        return true;
      });
    });
  });
}

test('production verifier resolves relative and absolute same-origin assets and ignores third-party and commented references', async () => {
  await withServer({ ...validResponses, '/': request => ({ type: 'text/html', body: `<main id="root"></main>
      <SCRIPT defer SRC=static/js/main.synthetic.js></SCRIPT>
      <link href="http://${request.headers.host}/static/css/main.synthetic.css" REL="stylesheet">
      <script src="https://third-party.invalid/external.js"></script>
      <!-- <script src="/missing-commented.js"></script> -->
      <link rel="preload" as="font" href="/not-a-stylesheet.woff2">` }) }, async () => {
    await assert.doesNotReject(verifyProduction());
  });
});


test("production verifier fails when the API is not ready", async () => {
  await withServer({
    ...validResponses,
    "/api/health": {
      type: "application/json",
      body: JSON.stringify({
        status: "not_ready",
        configuration_errors: [],
        database: "unavailable",
        indexes: "not_ready",
      }),
    },
  }, async () => {
    await assert.rejects(verifyProduction(), /health check is not ready/i);
  });
});
