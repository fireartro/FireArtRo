const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const EXPECTED_TITLE = 'Spectacole cu drone și artificii pentru evenimente | FireArtRo';
const EXPECTED_DESCRIPTION = 'FireArtRo creează spectacole cu drone, artificii și efecte scenice pentru nunți, evenimente corporate și festivaluri din România.';

test('the initial homepage response describes the services before the brand', () => {
  const html = fs.readFileSync(
    path.resolve(__dirname, '../frontend/public/index.html'),
    'utf8',
  );
  const compactHtml = html.replace(/\s+/g, ' ');

  assert.ok(compactHtml.includes(`<title>${EXPECTED_TITLE}</title>`));
  assert.ok(compactHtml.includes(`name="description" content="${EXPECTED_DESCRIPTION}"`));
  assert.ok(compactHtml.includes(`property="og:title" content="${EXPECTED_TITLE}"`));
  assert.ok(compactHtml.includes(`name="twitter:title" content="${EXPECTED_TITLE}"`));
});
