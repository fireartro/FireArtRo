// React Router 7 uses the platform encoder APIs during module initialization.
// CRA's Jest environment (Jest 27) does not provide them, although modern
// browsers and the production build do.
const { TextEncoder, TextDecoder } = require('util');

global.TextEncoder ??= TextEncoder;
global.TextDecoder ??= TextDecoder;
