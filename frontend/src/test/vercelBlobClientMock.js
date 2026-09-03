// Upload transport is verified by the Node API suite. Frontend unit tests only
// need to import the feature without pulling Vercel Blob's Web Streams runtime.
export const upload = () => Promise.reject(new Error('Blob upload is unavailable in unit tests.'));
