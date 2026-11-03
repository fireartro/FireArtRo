const { test, expect } = require('@playwright/test');
const baseURL=process.env.PLAYWRIGHT_BASE_URL||'http://127.0.0.1:4173';
const heroSources=require('../src/data/heroDelivery.json');

const active = page => page.locator('.hero-montage__video--visible');
async function enter(page) {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const consent = page.getByRole('button', { name: 'Doar necesare', exact: true });
  await consent.waitFor({state:'visible',timeout:8000}).catch(()=>{});
  if (await consent.isVisible().catch(() => false)) {
    await consent.click();
    await expect(consent).toBeHidden();
  }
  await expect(active(page)).toHaveCount(1, { timeout: 25000 });
  await expect.poll(() => active(page).evaluate(v => v.readyState >= 2 && !v.paused && v.currentTime > 0), { timeout: 25000 }).toBe(true);
}
async function seek(page, time) {
  await active(page).evaluate((v, t) => { v.currentTime = t; }, time);
  await expect.poll(() => active(page).evaluate(v => v.seeking)).toBe(false);
}

const sizes = [
  ['small-phone',320,568,2], ['phone-landscape',844,390,2],
  ['phone',375,812,2], ['phone-retina',430,932,3],
  ['tablet-portrait',768,1024,2], ['tablet-wide',1024,768,2],
  ['desktop',1512,982,1], ['retina',1512,982,2],
  ['2k',2560,1440,1], ['4k',3840,2160,1], ['ultrawide',3440,1440,1],
];
for (const [name,width,height,deviceScaleFactor] of sizes) {
  test(`new hero plays and keeps titles in bounds: ${name}`, async ({ browser }, testInfo) => {
    const context = await browser.newContext({ baseURL, viewport:{width,height}, deviceScaleFactor, reducedMotion:'no-preference' });
    const page = await context.newPage();
    const errors=[];
    page.on('pageerror', error => errors.push(error.message));
    await enter(page);
    await expect(active(page)).toHaveCSS('object-fit','cover');
    const state=await active(page).evaluate(v => ({src:v.dataset.heroSource,w:v.videoWidth,h:v.videoHeight,t:v.currentTime,quality:v.dataset.mediaQuality}));
    expect(await active(page).evaluate(v=>v.currentSrc)).toMatch(/^blob:/);
    await expect(active(page)).toHaveAttribute('data-hero-download-state','ready');
    const portrait=height>width;
    expect(state.src).toContain(heroSources[portrait?'portrait':'wide'][state.quality][0]);
    // Windows WebKit rounds its display-sized decode surface to whole pixels.
    // Exact encoded dimensions are independently checked by verify.py.
    expect(Math.abs(state.w-state.h*(portrait?9/16:16/9))).toBeLessThanOrEqual(1);
    await expect.poll(() => active(page).evaluate(v=>v.currentTime)).toBeGreaterThan(state.t+.2);
    await seek(page,19.5);
    await expect(page.locator('[data-cue="points"]')).toHaveCSS('visibility','visible');
    await expect(page.locator('[data-cue="points"] .hero-kinetic__lead').first()).toBeVisible();
    // The actual photographed formation at 19.5 s must fit, including its top.
    // These source-image bounds include the full blue spiral or gold wings.
    const formation=await active(page).evaluate((v,isPortrait)=>{
      const rect=v.getBoundingClientRect();
      const source=isPortrait?{w:2160,h:3840,box:[.18,.12,.88,.64]}:{w:3840,h:2160,box:[.2,.08,.82,.65]};
      const scale=Math.max(rect.width/source.w,rect.height/source.h);
      const renderedW=source.w*scale,renderedH=source.h*scale;
      const [x,y]=getComputedStyle(v).objectPosition.split(' ').map(value=>parseFloat(value)/100);
      const left=rect.left+(rect.width-renderedW)*x,top=rect.top+(rect.height-renderedH)*y;
      return {left:left+source.box[0]*renderedW,top:top+source.box[1]*renderedH,
        right:left+source.box[2]*renderedW,bottom:top+source.box[3]*renderedH,
        width:innerWidth,height:rect.bottom};
    },portrait);
    expect(formation.left).toBeGreaterThanOrEqual(0);
    expect(formation.top).toBeGreaterThanOrEqual(0);
    expect(formation.right).toBeLessThanOrEqual(formation.width);
    expect(formation.bottom).toBeLessThanOrEqual(formation.height);
    const bounds=await page.evaluate(()=>{
      const cue=document.querySelector('[data-cue="points"] .hero-kinetic__lead').getBoundingClientRect();
      const hero=document.querySelector('.nr-hero').getBoundingClientRect();
      return {left:cue.left,right:cue.right,top:cue.top,bottom:cue.bottom,heroBottom:hero.bottom,scroll:document.documentElement.scrollWidth,width:innerWidth};
    });
    expect(bounds.scroll).toBeLessThanOrEqual(width+1);
    expect(bounds.left).toBeGreaterThanOrEqual(-1);
    expect(bounds.right).toBeLessThanOrEqual(width+1);
    expect(bounds.bottom).toBeLessThanOrEqual(bounds.heroBottom+1);
    expect(errors).toEqual([]);
    await page.screenshot({path:testInfo.outputPath(`${name}.png`)});
    await seek(page,23.0);
    const stack=page.locator('[data-cue="rhythm"]');
    await expect(stack).toHaveCSS('visibility','visible');
    await expect(stack.locator('.hero-kinetic__lead')).toHaveCSS('color','rgb(120, 184, 255)');
    await expect(stack.locator('.hero-kinetic__echo')).toHaveCount(4);
    const rows=await stack.evaluate(cue=>{
      const hero=cue.closest('.nr-hero').getBoundingClientRect();
      const actions=cue.closest('.nr-hero').querySelector('.nr-hero__actions').getBoundingClientRect();
      return [...cue.querySelectorAll('.hero-kinetic__lead,.hero-kinetic__echo')].map(node=>{
        const range=document.createRange();range.selectNodeContents(node);
        const r=range.getBoundingClientRect();
        return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,heroBottom:hero.bottom,actionsBottom:actions.bottom,opacity:Number(node.style.opacity)};
      });
    });
    for(const row of rows){
      expect(row.opacity).toBeGreaterThan(0);
      expect(row.left).toBeGreaterThanOrEqual(-1);
      expect(row.right).toBeLessThanOrEqual(width+1);
      expect(row.top).toBeGreaterThanOrEqual(0);
      expect(row.bottom).toBeLessThanOrEqual(row.heroBottom);
      if((width<=900&&height>600)||height>width)expect(row.top).toBeGreaterThan(row.actionsBottom);
    }
    await page.screenshot({path:testInfo.outputPath(`${name}-five-rows.png`)});
    await context.close();
  });
}

test('three real 40-second chapters switch, loop and retain the playhead on rotation', async ({page})=>{
  await page.setViewportSize({width:768,height:1024});
  await enter(page);
  await page.evaluate(()=>{
    window.heroHandoffs=[];let previous='0';
    window.heroHandoffObserver=new MutationObserver(()=>{
      const v=document.querySelector('.hero-montage__video--visible');
      if(v&&v.dataset.filmIndex!==previous){
        previous=v.dataset.filmIndex;
        window.heroHandoffs.push({chapter:previous,opacity:Number(getComputedStyle(v).opacity)});
      }
    });
    window.heroHandoffObserver.observe(document.querySelector('.hero-montage'),{subtree:true,attributes:true,childList:true});
  });
  for (const index of [1,2,0]) {
    await seek(page,39.9);
    await expect(active(page)).toHaveAttribute('data-film-index',String(index),{timeout:15000});
    await expect.poll(()=>active(page).evaluate(v=>!v.paused&&v.currentTime>0)).toBe(true);
    expect(await active(page).evaluate(v=>v.duration)).toBeCloseTo(40,2);
  }
  const handoffs=await page.evaluate(()=>{
    window.heroHandoffObserver.disconnect();
    return window.heroHandoffs;
  });
  expect(handoffs).toEqual([1,2,0].map(index=>({chapter:String(index),opacity:1})));
  await seek(page,12.3);
  await page.setViewportSize({width:1024,height:768});
  await expect.poll(()=>active(page).evaluate(v=>v.dataset.heroSource)).toMatch(/(?:hero-film-wide-1|film-spectacol-panoramic-1)/);
  await expect.poll(()=>active(page).evaluate(v=>v.readyState>=2&&!v.paused)).toBe(true);
  const time=await active(page).evaluate(v=>v.currentTime);
  expect(time).toBeGreaterThanOrEqual(12.3);
  expect(time).toBeLessThan(17);
});

for(const [name,width,height] of [['phone',390,844],['tablet',768,1024],['desktop',1512,982]]){
  test(`all nine phrases and five-row accents fit: ${name}`,async({browser})=>{
    const context=await browser.newContext({baseURL,viewport:{width,height},deviceScaleFactor:2});
    const page=await context.newPage();await enter(page);
    for(let chapter=0;chapter<3;chapter++){
      const cues=chapter===0?[[2,'form'],[19.5,'points'],[23,'rhythm']]:chapter===1?(width>height?[[14,'color'],[26,'day'],[31,'sync']]:[[2,'color'],[14,'day'],[22,'sync']]):(width>height?[[3.5,'story'],[6.5,'combined'],[33.5,'finale']]:[[3.5,'story'],[13.5,'combined'],[33.5,'finale']]);
      for(const [time,id] of cues){
        await seek(page,time);const cue=page.locator(`[data-cue="${id}"]`);
        await expect(cue).toHaveCSS('visibility','visible');
        const bounds=await cue.evaluate(node=>{
          const hero=node.closest('.nr-hero').getBoundingClientRect();
          return [...node.querySelectorAll('.hero-kinetic__lead,.hero-kinetic__echo')].filter(n=>Number(n.style.opacity)>.1).map(n=>{
            const range=document.createRange();range.selectNodeContents(n);const r=range.getBoundingClientRect();
            return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,heroBottom:hero.bottom};
          });
        });
        expect(bounds.length).toBeGreaterThan(0);
        for(const b of bounds){expect(b.left).toBeGreaterThanOrEqual(0);expect(b.right).toBeLessThanOrEqual(width);expect(b.top).toBeGreaterThanOrEqual(0);expect(b.bottom).toBeLessThanOrEqual(b.heroBottom);}
      }
      if(chapter<2){await seek(page,39.9);await expect(active(page)).toHaveAttribute('data-film-index',String(chapter+1),{timeout:15000});}
    }
    await context.close();
  });
}

test('4K media failure falls back to real HD media',async({browser})=>{
  const context=await browser.newContext({baseURL,viewport:{width:1920,height:1080},deviceScaleFactor:2});
  const page=await context.newPage();
  await enter(page);
  await expect(active(page)).toHaveAttribute('data-media-quality','uhd');
  // WebKit loads media through its native media stack, outside page.route.
  // An actual missing file makes every engine exercise the same network error.
  await active(page).evaluate(v=>{v.src='/media/qa-missing-uhd.mp4';v.load();});
  await expect.poll(()=>active(page).evaluate(v=>v.dataset.heroSource)).toContain('film-spectacol-panoramic-1-hd');
  await expect(active(page)).toHaveAttribute('data-media-quality','hd');
  await expect.poll(()=>active(page).evaluate(v=>v.readyState>=2&&!v.paused)).toBe(true);
  const state=await active(page).evaluate(v=>({ratio:v.videoWidth/v.videoHeight,time:v.currentTime}));
  // Windows WebKit reports the decoder's display-sized surface here. The
  // actual encoded 1920x1080 dimensions are checked by verify.py with ffprobe.
  expect(state.ratio).toBeCloseTo(16/9,2);
  await expect.poll(()=>active(page).evaluate(v=>v.currentTime)).toBeGreaterThan(state.time+.2);
  await context.close();
});

test('prolonged portrait buffering switches to lightweight delivery at the current moment',async({browser})=>{
  const context=await browser.newContext({baseURL,viewport:{width:430,height:932},deviceScaleFactor:3});
  const page=await context.newPage();
  await enter(page);
  await expect(active(page)).toHaveAttribute('data-media-quality',/^(?:retina|hd)$/);
  await seek(page,12);
  await active(page).evaluate(v=>{
    Object.defineProperty(v,'readyState',{configurable:true,get:()=>2});
    Object.defineProperty(v,'networkState',{configurable:true,get:()=>2});
  });
  await expect(active(page)).toHaveAttribute('data-media-quality','light',{timeout:14000});
  await expect.poll(()=>active(page).evaluate(v=>v.readyState>=2&&!v.paused)).toBe(true);
  const time=await active(page).evaluate(v=>v.currentTime);
  expect(time).toBeGreaterThanOrEqual(12);
  expect(await active(page).getAttribute('data-film-index')).toBe('0');
  await expect.poll(()=>active(page).evaluate(v=>v.currentTime)).toBeGreaterThan(time+.2);
  await context.close();
});
