const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

test('published metadata and same-origin fallbacks use the approved fireart.ro domain', () => {
  const business = read('frontend/src/data/businessContent.js');
  const meta = read('frontend/src/hooks/usePageMeta.js');
  const cors = read('backend/server.py');
  const environment = read('backend/.env.example');

  assert.match(business, /CANONICAL_SITE_URL = "https:\/\/fireart\.ro"/);
  assert.match(meta, /CANONICAL_SITE_URL/);
  assert.match(cors, /CORS_ORIGINS", "https:\/\/fireart\.ro"/);
  assert.match(environment, /CORS_ORIGINS=http:\/\/localhost:3000,https:\/\/fireart\.ro/);
  assert.doesNotMatch(`${business}\n${meta}\n${cors}\n${environment}`, /www\.fireartro\.ro/);
});
