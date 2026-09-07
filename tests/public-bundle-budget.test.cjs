const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const buildDir = path.resolve(__dirname, '../frontend/build/static');

function mainAsset(directory, extension) {
  const assetDir = path.join(buildDir, directory);
  const matches = fs.readdirSync(assetDir)
    .filter((name) => name.startsWith('main.') && name.endsWith(extension));

  assert.equal(matches.length, 1, `expected one main ${extension} asset`);
  return path.join(assetDir, matches[0]);
}

test('the render-blocking public stylesheet stays within its launch budget', () => {
  const cssBytes = fs.statSync(mainAsset('css', '.css')).size;
  assert.ok(cssBytes <= 320_000, `main CSS is ${cssBytes} bytes; budget is 320000`);
});

test('the initial public JavaScript stays within its launch budget', () => {
  const jsBytes = fs.statSync(mainAsset('js', '.js')).size;
  assert.ok(jsBytes <= 940_000, `main JS is ${jsBytes} bytes; budget is 940000`);
});
