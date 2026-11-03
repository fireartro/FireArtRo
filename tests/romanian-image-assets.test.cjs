const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const root = path.resolve(__dirname, '..');
const {paths, metadata} = require('../frontend/src/data/romanianImageNames.json');
const config = require('../vercel.json');

test('every renamed image keeps a direct permanent legacy redirect to a real asset', () => {
  assert.ok(Object.keys(paths).length > 200);
  assert.equal(new Set(Object.values(paths)).size, Object.keys(paths).length);
  for (const [old, target] of Object.entries(paths)) {
    assert.match(target, /^\/media\/[a-z0-9/-]+\.(webp|png|jpe?g|svg)$/);
    assert.ok(!paths[target], `redirect chain for ${target}`);
    assert.ok(fs.existsSync(path.join(root, 'frontend/public', target)), target);
    assert.deepEqual(config.redirects.find(r=>r.source===old),
      {source:old,destination:target,permanent:true});
  }
});

test('each imported image metadata rule points to its actual unchanged gallery entry', () => {
  const entries = require('../frontend/src/data/importedGalleryItems.json');
  for (const [id, rule] of Object.entries(metadata)) {
    const entry = entries.find(x=>x.id===id);
    assert.ok(entry, id);
    assert.equal(entry.src.split('?')[0], rule.src, id);
    for (const [field, copy] of Object.entries(rule.fields)) assert.equal(entry[field], copy.after);
  }
});
