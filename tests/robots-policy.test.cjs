const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const robots = fs.readFileSync(path.resolve(__dirname, '../frontend/public/robots.txt'), 'utf8');
const rules = robots.split(/\r?\n/).flatMap(line => {
  const match = line.match(/^(Allow|Disallow):\s*(\S+)/);
  if (!match) return [];
  const [, kind, pattern] = match;
  const expression = pattern.replace(/[.+?^{}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  return [{ kind, length: pattern.replace(/[*$]/g, '').length, matcher: new RegExp(`^${expression}`) }];
});

function canCrawl(url) {
  const rule = rules.filter(rule => rule.matcher.test(url))
    .sort((a, b) => b.length - a.length || (a.kind === 'Allow' ? -1 : 1))[0];
  return rule?.kind !== 'Disallow';
}

test('public robots policy allows anonymous publication, Blog and cover resources', () => {
  for (const url of [
    '/', '/static/js/main.synthetic.js', '/media/hero-film-wide-1.mp4?v=synthetic',
    '/api/sitemap.xml', '/api/content', '/api/content/revision',
    '/api/content?cache=synthetic', '/api/content/revision?cache=synthetic',
    '/api/blog/posts', '/api/blog/posts?limit=3', '/api/blog/posts/synthetic-article',
    '/api/blog/revision', '/api/blog/revision?cache=synthetic',
    '/api/blog/media/synthetic-cover', '/api/blog/media/synthetic-cover?v=1',
  ]) assert.equal(canCrawl(url), true, `Rendering resource blocked: ${url}`);
});

test('public robots exceptions keep Admin, private APIs and adjacent path names blocked', () => {
  for (const url of [
    '/admin', '/admin/content', '/api/admin/content/draft', '/api/admin/blog/posts',
    '/api/admin/blob-upload', '/api/quotes', '/api/auth/login', '/api/inbox',
    '/api/webhooks/resend', '/api/health', '/api/content/draft', '/api/content/revisions',
    '/api/content/revision/private', '/api/content-private', '/api/blog/admin',
    '/api/blog/posts-private', '/api/blog/media-private', '/api/sitemap.xml/private',
  ]) assert.equal(canCrawl(url), false, `Private resource allowed: ${url}`);
  assert.match(robots, /^Sitemap: https:\/\/fireart\.ro\/api\/sitemap\.xml$/m);
});
