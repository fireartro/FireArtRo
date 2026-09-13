const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const postcss = require('../frontend/node_modules/postcss');
const cssnano = require(require.resolve('cssnano', { paths: [path.dirname(require.resolve('../frontend/node_modules/css-minimizer-webpack-plugin'))] }));

test('responsive navigation sizing survives the production CSS minimizer without warnings', async () => {
  const file = path.resolve(__dirname, '../frontend/src/styles/navigation-prominence.css');
  const result = await postcss([cssnano()]).process(fs.readFileSync(file, 'utf8'), { from: file });
  assert.deepEqual(result.warnings().map(item => item.text), []);
});
