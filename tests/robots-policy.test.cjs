const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

test('public robots policy avoids crawling private administration and API endpoints', () => {
  const robots = fs.readFileSync(path.resolve(__dirname, '../frontend/public/robots.txt'), 'utf8');
  assert.match(robots, /^Disallow: \/admin$/m);
  assert.match(robots, /^Disallow: \/api\/$/m);
  assert.match(robots, /^Sitemap: https:\/\/fireart\.ro\/sitemap\.xml$/m);
});
