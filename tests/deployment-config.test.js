import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function mediaCachePolicy(asset) {
  const config = JSON.parse(await readFile(path.join(projectRoot, 'vercel.json'), 'utf8'));
  const url = new URL(asset, 'https://fireart.ro');
  let policy;
  for (const rule of config.headers.filter(({ source }) => source.startsWith('/media/'))) {
    const matcher = new RegExp(`^${rule.source.replace(':asset*', '(.*)')}$`);
    if (!matcher.test(url.pathname)) continue;
    if (rule.has?.some(condition => condition.type !== 'query'
      || !url.searchParams.has(condition.key)
      || !new RegExp(`^${condition.value}$`).test(url.searchParams.get(condition.key)))) continue;
    policy = rule.headers.find(({ key }) => key.toLowerCase() === 'cache-control')?.value || policy;
  }
  return policy;
}

test('versioned hero films and posters receive the existing immutable media policy', async () => {
  for (const asset of [
    '/media/hero-film-wide-1.mp4?v=20260926-r6',
    '/media/hero-film-portrait-3.mp4?v=20260926-r6',
    '/media/hero-film-wide.webp?v=20260926-r6',
    '/media/hero-film-portrait.webp?v=20260926-r6',
    '/media/fireart-hero-wide.mp4?v=synthetic',
  ]) assert.equal(await mediaCachePolicy(asset), 'public, max-age=31536000, immutable', asset);
});

test('unversioned and unrelated mutable media remain revalidatable', async () => {
  for (const asset of [
    '/media/hero-film-wide-1.mp4', '/media/hero-film-portrait.webp',
    '/media/hero-film-wide.webp?v=', '/media/hero-film-wide.webp?preview=1',
    '/media/fireart-hero-wide.mp4', '/media/gallery-photo.webp?v=synthetic',
  ]) assert.equal(await mediaCachePolicy(asset), 'public, max-age=86400, stale-while-revalidate=604800', asset);
});

async function filesUnder(relativeDirectory) {
  const directory = path.join(projectRoot, relativeDirectory);
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.name === '__pycache__' || entry.name.endsWith('.pyc')) continue;
    const relativePath = path.posix.join(relativeDirectory, entry.name);
    if (entry.isDirectory()) files.push(...await filesUnder(relativePath));
    else files.push(relativePath);
  }
  return files.sort();
}

test('Vercel deploys the CRA build alongside only the intended API functions', async () => {
  const config = JSON.parse(await readFile(path.join(projectRoot, 'vercel.json'), 'utf8'));
  assert.equal(config.framework, null);
  assert.equal(config.outputDirectory, 'frontend/build');
  assert.deepEqual(await filesUnder('api'), [
    'api/admin/blob-upload.js',
    'api/index.py',
    'api/page.js',
  ]);
});

test('the public HTML fallback preserves real 404s for missing static assets', async () => {
  const config = JSON.parse(await readFile(path.join(projectRoot, 'vercel.json'), 'utf8'));
  const fallback = config.rewrites.at(-1);
  const matcher = new RegExp(`^${fallback.source.replace(':publicPath', '')}$`);

  assert.equal(fallback.destination, '/api/page?__fireart_path=/:publicPath');
  assert.match('/pachete', matcher);
  assert.doesNotMatch('/media/inexistent.webp', matcher);
  assert.doesNotMatch('/static/js/inexistent.js', matcher);
  assert.doesNotMatch('/favicon.ico', matcher);
});

test('runtime public rendering is isolated from private API and Admin routing', async () => {
  const config = JSON.parse(await readFile(path.join(projectRoot, 'vercel.json'), 'utf8'));
  assert.equal(config.rewrites[0].source, '/api/page');
  assert.equal(config.rewrites[0].destination, '/api/page');
  assert.ok(config.rewrites.some(rule => rule.source === '/admin/:path*' && rule.destination === '/admin-shell.html'));
  assert.ok(config.rewrites.some(rule => rule.source === '/' && rule.destination === '/api/page?__fireart_path=/'));
  const page = config.functions['api/page.js'];
  assert.ok(page.includeFiles.includes('frontend/server-build/**'));
  assert.ok(page.includeFiles.includes('frontend/build/public-page-assets.json'));
  assert.ok(!page.includeFiles.includes('frontend/public/**'));
  assert.ok(config.redirects.some(rule => rule.source === '/admin/' && rule.destination === '/admin' && rule.permanent));
});

test('the production CSP permits only the Cloudflare origin required by Turnstile', async () => {
  const config = JSON.parse(await readFile(path.join(projectRoot, 'vercel.json'), 'utf8'));
  const globalHeaders = config.headers.find(({ source }) => source === '/(.*)').headers;
  const policy = globalHeaders.find(({ key }) => key === 'Content-Security-Policy').value;

  for (const directive of ['script-src', 'frame-src', 'connect-src']) {
    const value = policy.split(';')
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${directive} `));
    assert.match(value, /(?:^|\s)https:\/\/challenges\.cloudflare\.com(?:\s|$)/);
  }
  assert.doesNotMatch(policy, /(?:^|\s)https:(?:\s|;|$)/);
});

test('the production CSP permits only the exact GA4 script and collection origins', async () => {
  const config = JSON.parse(await readFile(path.join(projectRoot, 'vercel.json'), 'utf8'));
  const globalHeaders = config.headers.find(({ source }) => source === '/(.*)').headers;
  const policy = globalHeaders.find(({ key }) => key === 'Content-Security-Policy').value;
  const directives = Object.fromEntries(policy.split(';').map((part) => {
    const [name, ...values] = part.trim().split(/\s+/);
    return [name, values];
  }));

  assert.ok(directives['script-src'].includes('https://www.googletagmanager.com'));
  assert.ok(directives['connect-src'].includes('https://www.google-analytics.com'));
  assert.ok(directives['connect-src'].includes('https://region1.google-analytics.com'));
  assert.ok(!directives['script-src'].includes('https:'));
  assert.ok(!directives['connect-src'].includes('https:'));
});

test('the production script policy blocks injected inline JavaScript and string execution', async () => {
  const config = JSON.parse(await readFile(path.join(projectRoot, 'vercel.json'), 'utf8'));
  const policy = config.headers.find(({ source }) => source === '/(.*)').headers
    .find(({ key }) => key === 'Content-Security-Policy').value;
  const scripts = policy.split(';').map(part => part.trim())
    .find(part => part.startsWith('script-src ')).split(/\s+/).slice(1);
  assert.ok(scripts.includes("'self'"), 'The local startup and React bundle must remain permitted');
  assert.ok(!scripts.includes("'unsafe-inline'"), 'Arbitrary inline scripts must not execute');
  assert.ok(!scripts.includes("'unsafe-eval'"), 'String-to-code execution must not be permitted');
});
