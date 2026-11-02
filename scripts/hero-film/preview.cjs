// Production-build preview with the downloaded public CMS snapshot and byte ranges.
// No production mutation or private API access.
const fs=require('fs');
const path=require('path');
const http=require('http');
const repo=path.resolve(__dirname,'../..');
const root=path.join(repo,'frontend/build');
const snapshot=process.env.PUBLIC_CONTENT_SNAPSHOT||path.join(repo,'output/hero-rebuild/live/public-content.json');
const stagedMedia=process.env.HERO_MEDIA_DIRECTORY?path.resolve(process.env.HERO_MEDIA_DIRECTORY):null;
const types={'.html':'text/html; charset=utf-8','.js':'application/javascript','.css':'text/css','.json':'application/json','.mp4':'video/mp4','.webp':'image/webp','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.ico':'image/x-icon','.woff2':'font/woff2','.ttf':'font/ttf'};
const port=Number(process.env.PORT||4188);
http.createServer((req,res)=>{
  const url=new URL(req.url,'http://127.0.0.1');
  if(url.pathname==='/api/content') {
    if(!fs.existsSync(snapshot)){res.writeHead(503);res.end('Public snapshot missing');return;}
    res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});fs.createReadStream(snapshot).pipe(res);return;
  }
  let file=path.resolve(root,'.'+decodeURIComponent(url.pathname));
  if(!file.startsWith(root+path.sep)&&file!==root){res.writeHead(403);res.end();return;}
  if(stagedMedia&&/^\/media\/hero-film-(wide|portrait)(-[1-3](-(retina|uhd))?)?\.(mp4|webp)$/.test(url.pathname)){
    file=path.join(stagedMedia,path.basename(url.pathname));
    if(!fs.existsSync(file)){res.writeHead(404);res.end('Staged hero asset missing');return;}
  }
  if(!fs.existsSync(file)||!fs.statSync(file).isFile()) {
    if(path.extname(url.pathname)||url.pathname.startsWith('/api/')){res.writeHead(404);res.end();return;}
    file=path.join(root,'index.html');
  }
  const size=fs.statSync(file).size;
  const headers={'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store','Accept-Ranges':'bytes'};
  const range=req.headers.range?.match(/^bytes=(\d+)-(\d*)$/);
  if(range){
    const start=Number(range[1]),end=range[2]?Math.min(size-1,Number(range[2])):size-1;
    if(start>=size||end<start){res.writeHead(416,{'Content-Range':`bytes */${size}`});res.end();return;}
    res.writeHead(206,{...headers,'Content-Range':`bytes ${start}-${end}/${size}`,'Content-Length':end-start+1});
    fs.createReadStream(file,{start,end}).pipe(res);
  } else {res.writeHead(200,{...headers,'Content-Length':size});fs.createReadStream(file).pipe(res);}
}).listen(port,'127.0.0.1',()=>console.log(`Hero preview: http://127.0.0.1:${port}`));
