const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const publicRoot = path.join(root, 'frontend/public');
const images = require('../frontend/src/data/responsiveImages.json');

test('every derivative exists, saves bytes and keeps its original photograph intact', () => {
  assert.ok(Object.keys(images).length > 200);
  for (const [src, image] of Object.entries(images)) {
    const original = fs.readFileSync(path.join(publicRoot, src.split('?')[0]));
    assert.equal(crypto.createHash('sha256').update(original).digest('hex'), image.sha256, src);
    for (const format of ['avif', 'webp']) {
      let last = 0;
      for (const item of image[format]) {
        assert.ok(item.src.startsWith('/media/responsive/'), item.src);
        assert.ok(item.width > last && item.width <= image.width, item.src);
        assert.equal(fs.statSync(path.join(publicRoot, item.src)).size, item.bytes, item.src);
        assert.ok(item.bytes < original.length, item.src);
        last = item.width;
      }
    }
  }
});

test('the early poster preload matches the rendered AVIF poster sources and keeps WebP fallbacks', () => {
  const html = fs.readFileSync(path.join(publicRoot, 'index.html'), 'utf8');
  for (const [tag, widths] of [['portret', [480, 810, 1080]], ['panoramic', [960, 1440, 1920]]]) {
    for (const width of widths) {
      const src = `/media/optimized/spectacol-artificii-${tag}-${width}-20261103.avif`;
      assert.ok(fs.existsSync(path.join(publicRoot, src)), src);
      assert.ok(html.includes(src), src);
    }
  }
  assert.match(html, /<source[^>]+type="image\/webp"/);
});

test('the real hero source map only names existing compatible static video files', () => {
  const sources = require('../frontend/src/data/heroDelivery.json');
  for (const qualities of Object.values(sources)) {
    for (const files of Object.values(qualities)) {
      assert.equal(files.length, 3);
      for (const src of files) {
        const file = fs.readFileSync(path.join(publicRoot, src.split('?')[0]));
        assert.equal(file.subarray(4, 8).toString(), 'ftyp', src);
      }
    }
  }
});

test('dedicated AVIF crops retain the exact dimensions of the existing WebP presets', () => {
  const presets = require('../frontend/src/data/responsivePresetImages.json');
  for (const [original, preset] of Object.entries(presets)) {
    assert.ok(fs.existsSync(path.join(publicRoot, original)), original);
    assert.equal(fs.statSync(path.join(publicRoot, preset.src)).size, preset.bytes, preset.src);
  }
  assert.equal(presets['/media/optimized/pachet-artificii-noapte-640-20261102.webp'].width, 640);
  assert.equal(presets['/media/optimized/pachet-artificii-noapte-640-20261102.webp'].height, 960);
});
