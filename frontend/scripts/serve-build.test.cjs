const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { spawn } = require('node:child_process');

test('preview supports video byte ranges and a read-only content API', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fireart-preview-test-'));
  fs.writeFileSync(path.join(root, 'index.html'), '<html>preview</html>');
  fs.writeFileSync(path.join(root, 'sample.mp4'), Buffer.from('0123456789'));
  const received = [];
  const upstream = http.createServer((req, res) => {
    received.push({ method: req.method, url: req.url });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ title: 'Published content' }));
  });
  await new Promise(resolve => upstream.listen(0, '127.0.0.1', resolve));
  const server = spawn(process.execPath, [path.join(__dirname, 'serve-build.js')], {
    env: { ...process.env, PORT: '0', HOST: '127.0.0.1',
      FIREART_PREVIEW_ROOT: root,
      FIREART_PREVIEW_CONTENT_ORIGIN: `http://127.0.0.1:${upstream.address().port}` },
    windowsHide: true,
  });
  try {
    const origin = await new Promise((resolve, reject) => {
      let stdout = '';
      const timeout = setTimeout(() => reject(new Error('Preview did not start')), 5000);
      server.stdout.on('data', chunk => {
        stdout += chunk;
        const match = stdout.match(/http:\/\/127\.0\.0\.1:\d+/);
        if (match) { clearTimeout(timeout); resolve(match[0]); }
      });
      server.on('error', reject);
    });
    assert.notEqual(new URL(origin).port, '0', 'Print the actual ephemeral listener port');
    const content = await fetch(`${origin}/api/content`);
    assert.match(content.headers.get('content-type'), /application\/json/);
    assert.deepEqual(await content.json(), { title: 'Published content' });
    const denied = await fetch(`${origin}/api/content`, { method: 'POST' });
    assert.equal(denied.status, 405);
    assert.deepEqual(received, [{ method: 'GET', url: '/api/content' }]);
    const blog = await fetch(`${origin}/api/blog/posts?limit=3`);
    assert.equal(blog.status, 200);
    const reviews = await fetch(`${origin}/api/reviews`);
    assert.equal(reviews.status, 200);
    const admin = await fetch(`${origin}/api/admin/content`);
    assert.equal(admin.status, 404);
    assert.deepEqual(received.map(item => item.url), ['/api/content', '/api/blog/posts?limit=3', '/api/reviews']);
    const partial = await fetch(`${origin}/sample.mp4`, { headers: { Range: 'bytes=2-5' } });
    assert.equal(partial.status, 206);
    assert.equal(partial.headers.get('content-range'), 'bytes 2-5/10');
    assert.equal(await partial.text(), '2345');
    const suffix = await fetch(`${origin}/sample.mp4`, { headers: { Range: 'bytes=-3' } });
    assert.equal(await suffix.text(), '789');
    const invalid = await fetch(`${origin}/sample.mp4`, { headers: { Range: 'bytes=20-' } });
    assert.equal(invalid.status, 416);
    const head = await fetch(`${origin}/sample.mp4`, { method: 'HEAD' });
    assert.equal(head.headers.get('content-length'), '10');
    assert.equal(await head.text(), '');
  } finally {
    server.kill();
    await new Promise(resolve => upstream.close(resolve));
    assert.equal(path.dirname(root), path.resolve(os.tmpdir()));
    assert.ok(path.basename(root).startsWith('fireart-preview-test-'));
    fs.rmSync(root, { recursive: true, force: true });
  }
});
