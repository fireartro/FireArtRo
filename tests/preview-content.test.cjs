const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const scriptPath=path.resolve(__dirname,'../frontend/scripts/serve-build.js');
function preview(fetch){
  let handle;
  const http={createServer(fn){handle=fn;return {listen(){},address(){return {port:4173};}};}};
  vm.runInNewContext(readFileSync(scriptPath,'utf8'),{require:id=>id==='http'?http:require(id),__dirname:path.dirname(scriptPath),process:{env:{FIREART_PREVIEW_CONTENT_ORIGIN:'https://fireart.ro'},stdout:{write(){}}},fetch,URL,Buffer,AbortSignal});
  return async(url,headers={})=>{let status,responseHeaders,body;await handle({url,headers,method:'GET'},{writeHead(code,values){status=code;responseHeaders=values;},end(value){body=value;}});return {status,headers:responseHeaders,body};};
}
test('preview revalidates public revisions anonymously and preserves a bodyless 304',async()=>{
  let options;
  const request=preview(async(url,value)=>{assert.equal(url.pathname,'/api/content/revision');options=value;return {status:304,headers:new Headers({'etag':'"r1"','cache-control':'no-cache, must-revalidate'})};});
  const response=await request('/api/content/revision',{'if-none-match':'"r1"',cookie:'private-cookie'});
  assert.equal(response.status,304);assert.equal(response.headers.ETag,'"r1"');assert.equal(response.body,undefined);
  assert.equal(options.headers['If-None-Match'],'"r1"');assert.equal(options.headers.cookie,undefined);
});
test('preview never forwards private Admin endpoints',async()=>{
  const request=preview(()=>{throw new Error('Must not call production Admin');});
  assert.equal((await request('/api/admin/auth/session')).status,404);
});
