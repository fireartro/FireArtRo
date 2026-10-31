const { test, expect } = require('@playwright/test');
const active=page=>page.locator('.hero-montage__video--visible');
const picture=page=>active(page).evaluate(v=>{
 const canvas=document.createElement('canvas');canvas.width=32;canvas.height=18;
 const ctx=canvas.getContext('2d');ctx.drawImage(v,0,0,32,18);
 return Array.from(ctx.getImageData(0,0,32,18).data).join(',');
});
async function enter(page) {
 await page.goto('/',{waitUntil:'domcontentloaded'});
 await expect(page.locator('#fireart-intro')).toHaveCount(0,{timeout:30000});
 const consent=page.getByRole('button',{name:'Doar necesare',exact:true});
 if(await consent.isVisible())await consent.click();
 await expect.poll(()=>active(page).evaluate(v=>!v.paused&&v.readyState>=2&&v.currentTime>0)).toBe(true);
}
test('startup releases within 1.5 seconds when its first video is ready',async({page})=>{
 await page.addInitScript(()=>{
   window.introTiming={};
   window.addEventListener('fireart:intro-dismissed',()=>{window.introTiming.end=performance.now();});
   const timer=setInterval(()=>{
     const v=document.querySelector('#acasa video');
     if(v?.readyState>=4&&!window.introTiming.ready)window.introTiming.ready=performance.now();
     if(window.introTiming.end)clearInterval(timer);
   },20);
 });
 await enter(page);
 const timing=await page.evaluate(()=>({...window.introTiming,start:window.__fireartIntroStarted,locked:document.getElementById('root').inert}));
 expect(timing.locked).toBe(false);
 expect(timing.end-timing.start).toBeLessThanOrEqual(Math.max(1500,timing.ready-timing.start+220)+180);
});
test('foreground return restores actual decoded frames at the saved chapter',async({page})=>{
 await page.setViewportSize({width:390,height:844});await enter(page);
 await active(page).evaluate(v=>{v.currentTime=12;v.pause();window.dispatchEvent(new Event('pagehide'));});
 await page.waitForTimeout(1000);
 await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true})));
 const before=await active(page).evaluate(v=>({time:v.currentTime}));
 const firstPicture=await picture(page);
 await expect.poll(()=>active(page).evaluate(v=>v.currentTime)).toBeGreaterThan(before.time+.3);
 // WebKit on Windows does not expose decoded-frame counters. Compare the
 // decoded image itself, rather than mistaking an advancing clock for video.
 await expect.poll(()=>picture(page)).not.toBe(firstPicture);
 expect(await active(page).getAttribute('data-film-index')).toBe('0');
});
test('a decoder that stops presenting frames is replaced without restarting the film',async({page})=>{
 await page.addInitScript(()=>{
  const original=HTMLVideoElement.prototype.requestVideoFrameCallback;
  if(!original){
   const play=HTMLMediaElement.prototype.play;
   HTMLMediaElement.prototype.play=function(){return this.dataset.originalDecoder?Promise.resolve():play.call(this);};
   return;
  }
  HTMLVideoElement.prototype.requestVideoFrameCallback=function(callback){return original.call(this,(...args)=>{if(!window.freezeHeroDecoder||!this.matches('.hero-montage__video'))callback(...args);});};
 });
 await enter(page);
 await active(page).evaluate(v=>{v.currentTime=14;v.dataset.originalDecoder='true';window.freezeHeroDecoder=true;if(!v.requestVideoFrameCallback)v.pause();});
 await expect(page.locator('[data-original-decoder]')).toHaveCount(0,{timeout:10000});
 await page.evaluate(()=>window.freezeHeroDecoder=false);
 await expect.poll(()=>active(page).evaluate(v=>v.currentTime)).toBeGreaterThan(14);
 const firstPicture=await picture(page);
 await expect.poll(()=>picture(page)).not.toBe(firstPicture);
});
test('mobile logo and current partners remain readable without collisions',async({page},info)=>{
 await page.setViewportSize({width:390,height:844});await enter(page);
 const ratio=await page.locator('.site-navbar-brand img:visible').evaluate(v=>{
   const current=v.getBoundingClientRect().height;
   const style=v.getAttribute('style');v.style.height='2.75rem';v.style.maxWidth='min(9.5rem, 43vw)';
   const previous=v.getBoundingClientRect().height;
   if(style===null)v.removeAttribute('style');else v.setAttribute('style',style);
   return current/previous;
 });
 expect(ratio).toBeCloseTo(1.1,2);
 for(const viewport of [{width:390,height:844},{width:1512,height:982},{width:1440,height:900},{width:1024,height:768}]){
  await page.setViewportSize(viewport);
  await page.locator('#parteneri').scrollIntoViewIfNeeded();
  await page.waitForTimeout(250);
  const state=await page.locator('#parteneri').evaluate(section=>{
   const cards=[...section.querySelectorAll('.fa-partner__body')];
   const boxes=cards.filter(c=>getComputedStyle(c).visibility!=='hidden').map(c=>c.getBoundingClientRect());
   const hits=[];
   boxes.forEach((a,i)=>boxes.forEach((b,j)=>{if(j>i&&Math.min(a.right,b.right)-Math.max(a.left,b.left)>1&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>1)hits.push([i,j]);}));
   return {count:cards.length,hits,broken:[...section.querySelectorAll('img')].filter(i=>i.complete&&!i.naturalWidth).map(i=>i.src),overflow:Math.max(0,document.documentElement.scrollWidth-document.documentElement.clientWidth)};
  });
  expect(state).toEqual({count:26,hits:[],broken:[],overflow:0});
  await page.screenshot({path:info.outputPath(`partners-${viewport.width}.png`)});
 }
});
test('MacBook CSS viewports keep the same substantial scale in both browser engines',async({page})=>{
 await page.setViewportSize({width:1512,height:982});await enter(page);
 const metrics=await page.evaluate(()=>({root:parseFloat(getComputedStyle(document.documentElement).fontSize),nav:parseFloat(getComputedStyle(document.querySelector('.site-navbar-links>a')).fontSize),overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth}));
 expect(metrics.root).toBe(18);expect(metrics.nav).toBeGreaterThanOrEqual(15.75);expect(metrics.overflow).toBeLessThanOrEqual(0);
});

test('all 26 partners orbit continuously without controls, hidden cards or intersections',async({page},info)=>{
 await page.setViewportSize({width:1512,height:982});await enter(page);
 let previous;
 for(const progress of [.2,.5,.8]){
  await page.locator('.fa-partner-scroll').evaluate((node,p)=>window.scrollTo({top:scrollY+node.getBoundingClientRect().top+p*(node.offsetHeight-innerHeight),behavior:'instant'}),progress);
  await page.waitForTimeout(250);
  const state=await page.locator('.fa-partner-scroll').evaluate(node=>{
   const cards=[...node.querySelectorAll('.fa-partner')].filter(c=>getComputedStyle(c).visibility==='visible');
   const title=node.querySelector('header').getBoundingClientRect();
   const boxes=cards.map(c=>c.getBoundingClientRect());
   const overlaps=(a,b)=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;
   return {count:cards.length,positions:cards.map(c=>c.style.transform).join('|'),hits:boxes.some((a,i)=>overlaps(a,title)||boxes.slice(i+1).some(b=>overlaps(a,b))),outside:boxes.some(a=>a.left<0||a.right>innerWidth||a.top<0||a.bottom>innerHeight)};
  });
  expect(state.count).toBe(26);expect(state.hits).toBe(false);expect(state.outside).toBe(false);
  if(previous)expect(state.positions).not.toBe(previous);previous=state.positions;
  await page.screenshot({path:info.outputPath(`orbit-${progress}.png`)});
 }
 await expect(page.locator('.fa-partner-scroll button')).toHaveCount(0);
 await expect(page.locator('.fa-partner-scroll')).toHaveAttribute('data-layout','orbit');
 await expect(page.locator('.fa-partner__body:visible')).toHaveCount(26);
 const geometry=await page.locator('.fa-partner__body').first().evaluate(node=>({width:node.getBoundingClientRect().width,radius:parseFloat(getComputedStyle(node).borderRadius)}));
 expect(geometry.width).toBeLessThan(140);expect(geometry.radius).toBeGreaterThanOrEqual(22);
 const continuity=await page.locator('.fa-partner-scroll').evaluate(node=>new Promise(resolve=>{
   let frames=0,hidden=false,maxJump=0,previous;
   const sample=()=>{
     const cards=[...node.querySelectorAll('.fa-partner')];
     const boxes=cards.map(c=>c.getBoundingClientRect());
     hidden ||= cards.some(c=>getComputedStyle(c).visibility!=='visible'||Number(getComputedStyle(c).opacity)<1);
     if(previous)boxes.forEach((b,i)=>{maxJump=Math.max(maxJump,Math.hypot(b.x-previous[i].x,b.y-previous[i].y));});
     previous=boxes;
     if(++frames<90)requestAnimationFrame(sample);else resolve({hidden,maxJump});
   };requestAnimationFrame(sample);
 }));
 expect(continuity.hidden).toBe(false);expect(continuity.maxJump).toBeLessThan(20);
});
