import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

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
  ]);
});

test('the SPA fallback preserves real 404s for missing static assets', async () => {
  const config = JSON.parse(await readFile(path.join(projectRoot, 'vercel.json'), 'utf8'));
  const fallback = config.rewrites.at(-1);
  const matcher = new RegExp(`^${fallback.source}$`);

  assert.equal(fallback.destination, '/index.html');
  assert.match('/pachete', matcher);
  assert.doesNotMatch('/media/inexistent.webp', matcher);
  assert.doesNotMatch('/static/js/inexistent.js', matcher);
  assert.doesNotMatch('/favicon.ico', matcher);
});
