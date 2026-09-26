import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getDisplayDimensions, getPortraitFocusCrop } from './hero-media-geometry.mjs';

test('portrait MOV dimensions follow display rotation, not the encoded landscape container', () => {
  assert.deepEqual(getDisplayDimensions({ width: 3840, height: 2160, side_data_list: [{ rotation: -90 }] }), { width: 2160, height: 3840 });
  assert.deepEqual(getDisplayDimensions({ width: 3840, height: 2160 }), { width: 3840, height: 2160 });
});

test('focus crops stay within the decoded frame and preserve the full portrait height before zoom', () => {
  const crop = getPortraitFocusCrop({ width: 2160, height: 3840 }, { zoom: 1.25, y: 0.85 });
  assert.equal(crop.baseWidth, 2160);
  assert.equal(crop.baseHeight, 3840);
  assert.equal(crop.height, 3072);
  assert.ok(crop.top + crop.height <= 3840);
  const landscape = getPortraitFocusCrop({ width: 3840, height: 2160 }, { zoom: 1.5, y: 1 });
  assert.equal(landscape.baseHeight, 2160);
  assert.ok(landscape.width <= 3840);
});
