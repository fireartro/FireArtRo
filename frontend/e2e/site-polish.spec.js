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
 await expect(consent).toBeVisible();
 if(await consent.isVisible())await consent.click();
 await expect.poll(()=>active(page).evaluate(v=>!v.paused&&v.readyState>=2&&v.currentTime>0)).toBe(true);
}
test('startup releases within 1.5 seconds when its first video is ready',async({page})=>{
 await page.addInitScript(()=>{
   window.introTiming={};
   window.addEventListener('fireart:intro-dismissed',()=>{window.introTiming.end=performance.now();});
   const timer=setInterval(()=>{
     const v=document.querySelector('#acasa video');
     if(v?.readyState>=3&&!window.introTiming.ready)window.introTiming.ready=performance.now();
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


async function enterRibbons(page, progress=.3) {
 const node=page.getByTestId('partner-scroll');
 if (await node.getAttribute('data-layout') !== 'ribbons') await node.scrollIntoViewIfNeeded();
 await expect(node).toHaveAttribute('data-layout','ribbons');
 await node.evaluate(async (section,part)=>{
   window.scrollTo({top:scrollY+section.getBoundingClientRect().top+part*(section.offsetHeight-section.firstElementChild.offsetHeight),behavior:'instant'});
   await new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done)));
 },progress);
 return node;
}

test('two curved partner ribbons follow scroll, accept taps and recover after a tab return',async({page},info)=>{
 await enter(page);
 const node=await enterRibbons(page);
 const canvas=node.locator('canvas');
 const frame=async()=>require('crypto').createHash('sha256').update(await canvas.screenshot()).digest('hex');
 const before=await frame();
 await enterRibbons(page,.42);
 await expect.poll(frame).not.toBe(before);
 await expect(canvas).toHaveAttribute('data-settled','true');
 await expect(node.locator('.fa-partner__body')).toHaveCount(26);
 await expect(node.locator('button')).toHaveCount(0);
 await page.screenshot({path:info.outputPath('x-partner-ribbons.png')});
 // Find the interior of a visible card, clear of overlays and adjacent cards.
 const findTarget=()=>canvas.evaluate(c=>{
   const rect=c.getBoundingClientRect();
   function nameAt(x,y) {
     if(document.elementFromPoint(x,y)!==c) return '';
     c.dispatchEvent(new PointerEvent('pointermove',{clientX:x,clientY:y,pointerType:'mouse'}));
     return c.title;
   }
   for(let y=rect.top+rect.height*.40;y<rect.top+rect.height*.85;y+=18) {
     for(let x=rect.left+rect.width*.12;x<rect.left+rect.width*.88;x+=18) {
       const name=nameAt(x,y);
       if(name && [[-7,-7],[7,-7],[-7,7],[7,7]].every(([dx,dy])=>nameAt(x+dx,y+dy)===name)) {
         const link=Array.from(document.querySelectorAll('.fa-partner__body')).find(a=>a.getAttribute('aria-label')==='Deschide '+name);
         return {x,y,name,href:link.href};
       }
     }
   }
   return null;
 });
 const hit=await findTarget();
 expect(hit).not.toBeNull();
 if(!info.project.use.hasTouch) {
   await page.mouse.move(hit.x,hit.y);
   await expect(canvas).toHaveAttribute('title',hit.name);
 }
 const destination=new URL(hit.href);
 await page.context().route(url=>url.origin===destination.origin,route=>route.fulfill({body:'Partner destination'}));
 const popup=page.context().waitForEvent('page');
 if(info.project.use.hasTouch)await page.touchscreen.tap(hit.x,hit.y);
 else await page.mouse.click(hit.x,hit.y);
 const opened=await popup;
 await expect(opened).toHaveURL(hit.href);
 await opened.close();
 await page.bringToFront();
 await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true})));
 const targetName=()=>canvas.evaluate((c,{x,y})=>{
   c.dispatchEvent(new PointerEvent('pointermove',{clientX:x,clientY:y,pointerType:'mouse'}));
   return c.title;
 },hit);
 // Returning to the same scroll offset must put the original partner back
 // under the pointer, including after backing up through the helix.
 await enterRibbons(page,.62);
 await expect(canvas).toHaveAttribute('data-settled','true');
 await expect.poll(targetName).not.toBe(hit.name);
 await enterRibbons(page,.42);
 await expect(canvas).toHaveAttribute('data-settled','true');
 await expect.poll(targetName).toBe(hit.name);
});

test('partner ribbons fit phones, landscape rotation and shorter desktops',async({page})=>{
 await enter(page);
 for(const [width,height] of [[320,568],[390,844],[844,390],[1024,600],[1512,982]]) {
   await page.setViewportSize({width,height});
   const node=await enterRibbons(page);
   const state=await node.evaluate(n=>{
     const stage=n.firstElementChild.getBoundingClientRect();
     const heading=n.querySelector('header').getBoundingClientRect();
     const canvas=n.querySelector('canvas').getBoundingClientRect();
     return {overflow:Math.max(0,document.documentElement.scrollWidth-document.documentElement.clientWidth),
       clipped:canvas.top < -1||canvas.left<0||canvas.right>innerWidth||canvas.bottom>innerHeight,
       coversHeading:canvas.left < heading.right-1 && canvas.right > heading.left+1 &&
         canvas.top < heading.bottom-1 && canvas.bottom > heading.top+1,
       pinned:Math.abs(stage.top)<2,height:canvas.height};
   });
   expect(state.overflow).toBe(0);expect(state.clipped).toBe(false);expect(state.coversHeading).toBe(false);expect(state.pinned).toBe(true);
   expect(state.height).toBeGreaterThan(90);
 }
});

test('keyboard links and the WebGL failure fallback remain usable',async({page})=>{
 await enter(page);
 const node=await enterRibbons(page);
 const first=node.locator('.fa-partner__body').first();
 await first.focus();
 await expect(first).toBeFocused();
 const bounds=await first.boundingBox();
 expect(bounds.width).toBeGreaterThan(60);
 await node.locator('canvas').evaluate(c=>c.dispatchEvent(new Event('webglcontextlost',{cancelable:true})));
 await expect(node).toHaveAttribute('data-layout','grid');
 await expect(node.locator('canvas')).toHaveCount(0);
 await expect(node.locator('.fa-partner__body').first()).toBeVisible();
});

test('partners stay accessible as a grid with reduced motion',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.goto('/',{waitUntil:'domcontentloaded'});
 const grid=page.getByTestId('partner-scroll');
 await expect(grid).toHaveAttribute('data-layout','grid');
 await expect(grid.locator('a.fa-partner__body')).toHaveCount(26);
 await expect(grid.locator('canvas')).toHaveCount(0);
});

test('loading automatically opens when the browser never signals canplaythrough',async({page})=>{
 await page.addInitScript(()=>{
   const ready=Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype,'readyState');
   Object.defineProperty(HTMLMediaElement.prototype,'readyState',{configurable:true,get(){return Math.min(3,ready.get.call(this));}});
 });
 await enter(page);
 await expect(page.locator('#root')).not.toHaveAttribute('inert');
});

test('a stalled first film cannot trap the visitor and the loading footage keeps looping',async({page})=>{
 await page.route('**/media/hero-film-*.mp4*',route=>new Promise(resolve=>setTimeout(()=>resolve(route.abort()),12000)));
 await page.goto('/',{waitUntil:'domcontentloaded'});
 const footage=page.locator('#fireart-intro video');
 await expect(footage).toHaveJSProperty('loop',true);
 await expect.poll(()=>footage.evaluate(v=>v.currentTime)).toBeGreaterThan(.3);
 const duration=await footage.evaluate(v=>{
   v.currentTime=v.duration-.35;
   v.play().catch(()=>{});
   return v.duration;
 });
 await expect.poll(()=>footage.evaluate(v=>v.currentTime),{timeout:4500}).toBeLessThan(duration-.5);
 await expect(page.locator('#fireart-intro')).toHaveCount(0,{timeout:11000});
 await page.getByRole('button',{name:'Doar necesare',exact:true}).click();
 expect(await page.locator('#root').evaluate(root=>root.inert)).toBe(false);
});
