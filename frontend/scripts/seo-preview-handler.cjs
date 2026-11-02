const { pathToFileURL } = require('node:url');
const path = require('node:path');

module.exports = async function seoPreviewHandler(contentOrigin) {
  if (!contentOrigin) throw new Error('SSR preview requires a public content origin.');
  const origin = new URL(contentOrigin).origin;
  const {createPublicPageHandler} = await import(pathToFileURL(path.resolve(__dirname, '../../serverless/lib/public-page-handler.js')));
  async function json(pathname) {
    const response = await fetch(`${origin}${pathname}`, {credentials:'omit',cache:'no-store',signal:AbortSignal.timeout(15000)});
    if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) {
      throw Object.assign(new Error('Published content unavailable'),{status:response.status === 404 ? 404 : 503});
    }
    return response.json();
  }
  return createPublicPageHandler({readData: async url => {
    const pathname = new URL(url,'http://localhost').pathname;
    const slug = pathname.startsWith('/blog/') ? pathname.slice('/blog/'.length) : '';
    const [publication,posts,post] = await Promise.all([
      json('/api/content'),
      pathname === '/' || pathname === '/blog' ? json(`/api/blog/posts?limit=${pathname === '/' ? 3 : 100}`) : [],
      slug ? json(`/api/blog/posts/${encodeURIComponent(slug)}`) : null,
    ]);
    return {publication,posts,post};
  }});
};
