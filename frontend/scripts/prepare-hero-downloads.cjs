const fs = require('node:fs');
const path = require('node:path');
fs.copyFileSync(path.resolve(__dirname, '../src/lib/heroDownloadCache.js'), path.resolve(__dirname, '../public/hero-download-cache.js'));
