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
test('mobile logo is ten percent larger',async({page},info)=>{
 await page.setViewportSize({width:390,height:844});await enter(page);
 const ratio=await page.locator('.site-navbar-brand img:visible').evaluate(v=>{
   const current=v.getBoundingClientRect().height;
   const style=v.getAttribute('style');v.style.height='2.75rem';v.style.maxWidth='min(9.5rem, 43vw)';
   const previous=v.getBoundingClientRect().height;
   if(style===null)v.removeAttribute('style');else v.setAttribute('style',style);
   return current/previous;
 });
 expect(ratio).toBeCloseTo(1.1,2);
});
test('MacBook CSS viewports keep the same substantial scale in both browser engines',async({page})=>{
 await page.setViewportSize({width:1512,height:982});await enter(page);
 const metrics=await page.evaluate(()=>({root:parseFloat(getComputedStyle(document.documentElement).fontSize),nav:parseFloat(getComputedStyle(document.querySelector('.site-navbar-links>a')).fontSize),overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth}));
 expect(metrics.root).toBe(18);expect(metrics.nav).toBeGreaterThanOrEqual(15.75);expect(metrics.overflow).toBeLessThanOrEqual(0);
});

async function enterOrbit(page, progress) {
 const node = page.locator('.fa-partner-scroll');
 await expect(node).toHaveAttribute('data-layout', 'orbit');
 await expect(async () => {
   await node.evaluate(async (section, part) => {
     const top=scrollY + section.getBoundingClientRect().top + part * (section.offsetHeight - section.firstElementChild.offsetHeight);
     window.scrollTo({top, behavior:'instant'});
     // WebKit delivers native scroll and animation sampling on separate ticks.
     await new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done)));
   }, progress);
   const error=await node.evaluate((section,part)=>section.getBoundingClientRect().top + part * (section.offsetHeight - section.firstElementChild.offsetHeight),progress);
   expect(Math.abs(error)).toBeLessThan(2);
   await expect.poll(() => node.locator('li').first().evaluate(el => el.getAnimations()[0]?.playState)).toBe('running');
   expect(Math.abs(await node.locator('.fa-partner-scroll__stage').evaluate(stage => stage.getBoundingClientRect().top))).toBeLessThan(2);
 }).toPass({timeout:7000});
 return node;
}

// A valid crossing has two logo surfaces at the same pixel. The browser must
// paint and hit-test the nearer partner first, regardless of DOM order.
async function orbitSnapshot(node) {
 return node.evaluate(section => {
   const cards = [...section.querySelectorAll('li')];
   const boxes = cards.map(card => card.getBoundingClientRect());
   const depth = cards.map(card => new DOMMatrix(getComputedStyle(card).transform).a);
   const inFront = new Set();
   let crossings = 0, wrongSurface = 0, hit;
   const heading = section.querySelector('header').getBoundingClientRect();
   const docks = [...document.querySelectorAll('.desktop-social-dock,.mobile-social-dock')].map(d => d.getBoundingClientRect()).filter(r=>r.width);
   const intersects = (a,b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
   boxes.forEach((a,i) => {
     const center = document.elementFromPoint(a.x + a.width / 2, a.y + a.height / 2)?.closest('li');
     if (center === cards[i]) inFront.add(i);
     boxes.slice(i+1).forEach(b => {
       const left=Math.max(a.left,b.left), right=Math.min(a.right,b.right);
       const top=Math.max(a.top,b.top), bottom=Math.min(a.bottom,b.bottom);
       if (right-left<10 || bottom-top<10) return;
       const x=(left+right)/2, y=(top+bottom)/2;
       const stack = [...new Set(document.elementsFromPoint(x,y).map(el=>el.closest('.fa-partner')).filter(Boolean))];
       if(stack.length<2) return;
       crossings++;
       const first=cards.indexOf(stack[0]);
       if(stack.slice(1).some(card=>depth[cards.indexOf(card)] > depth[first]+.009)) wrongSurface++;
       const front=boxes[first];
       const margin=Math.min(x-front.left,front.right-x,y-front.top,front.bottom-y);
       if (!hit || margin>hit.margin) hit={x,y,margin,href:cards[first].querySelector('a').href};
     });
   });
   return {
     count:cards.length, inFront:[...inFront], crossings, wrongSurface, hit,
     clipped:boxes.flatMap((b,i)=>b.left < -1 || b.right > innerWidth+1 || b.top < heading.bottom-1 || b.bottom > innerHeight+1 || docks.some(d=>intersects(d,b))
       ? [{partner:cards[i].dataset.partnerId,rect:b.toJSON(),heading:heading.bottom,docks:docks.map(d=>d.toJSON())}] : []),
     overflow:Math.max(0,document.documentElement.scrollWidth-document.documentElement.clientWidth),
     broken:[...section.querySelectorAll('img')].filter(img=>!img.complete || !img.naturalWidth).map(img=>img.src),
   };
 });
}

test('partner orbits have real front-to-back crossings and working links', async ({page}, info) => {
 await enter(page);
 const node = await enterOrbit(page, .30);
 await expect(node.locator('a.fa-partner__body')).toHaveCount(26);
 await expect(node.locator('button')).toHaveCount(0);
 const first = node.locator('li').first();
 const x = () => first.evaluate(card=>card.getBoundingClientRect().x);
 const start=await x();
 await expect.poll(x).not.toBe(start);
 const seen = new Set();
 for(const part of [.02,.10,.18,.26,.34,.42,.50,.58,.66,.74,.82,.90,.98]) {
   await enterOrbit(page, part);
   await expect.poll(async()=> (await orbitSnapshot(node)).broken).toEqual([]);
   const view=await orbitSnapshot(node);
   expect(view.clipped).toEqual([]);
   expect(view.overflow).toBe(0);
   expect(view.wrongSurface).toBe(0);
   expect(view.inFront.length).toBeGreaterThan(7);
   view.inFront.forEach(i=>seen.add(i));
 }
 expect(seen.size).toBe(26);
 await page.screenshot({path:info.outputPath('partner-orbits.png')});
 await page.context().route('**/*', route=>route.request().isNavigationRequest() ? route.fulfill({body:'Partner destination'}) : route.continue());
 const view=await orbitSnapshot(node);
 expect(view.crossings).toBeGreaterThan(0);
 // Leave the animation running while exercising a real tap/click at a crossing.
 const popup=page.waitForEvent('popup');
 if(info.project.use.hasTouch) await page.touchscreen.tap(view.hit.x,view.hit.y);
 else await page.mouse.click(view.hit.x,view.hit.y);
 await expect(await popup).toHaveURL(view.hit.href);
});

test('partner orbits fit short desktop windows, phones and landscape rotation',async({page})=>{
 await enter(page);
 for(const [width,height] of [[320,568],[390,844],[844,390],[1024,600],[1366,500],[1536,736]]) {
   await page.setViewportSize({width,height});
   const node=await enterOrbit(page,.42);
   const view=await orbitSnapshot(node);
   expect(view.clipped, `viewport ${width}x${height}`).toEqual([]);
   expect(view.overflow).toBe(0);
   expect(view.wrongSurface).toBe(0);
 }
});

test('a finger swipe turns the partner orbits on Android',async({page},info)=>{
 test.skip(info.project.name !== 'mobile-chromium', 'CDP touch gestures run on Android Chromium.');
 await enter(page);
 const node = await enterOrbit(page,.25);
 const time = () => node.locator('li').first().evaluate(el=>el.getAnimations()[0].currentTime);
 const before = await time();
 const initialScroll = await page.evaluate(()=>scrollY);
 const client = await page.context().newCDPSession(page);
 try {
   await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:160,y:500}]});
   for (const y of [475,450,425,400,375,350]) {
     await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:160,y}]});
     await page.waitForTimeout(28);
   }
   await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
   await expect.poll(()=>page.evaluate(()=>scrollY)).toBeGreaterThan(initialScroll+75);
   await expect.poll(time).toBeGreaterThan(before+2200);
 } finally {
   await client.detach();
 }
});

test('partners stay accessible as a grid with reduced motion',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.goto('/',{waitUntil:'domcontentloaded'});
 const grid=page.locator('.fa-partner-scroll');
 await expect(grid).toHaveAttribute('data-layout','grid');
 await expect(grid.locator('a.fa-partner__body')).toHaveCount(26);
 expect(await grid.locator('ul').evaluate(ul=>ul.getAnimations({subtree:true}).length)).toBe(0);
});
