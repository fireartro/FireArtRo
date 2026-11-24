const {test,expect}=require('@playwright/test');
const { mockConsentLedger } = require('./consent-fixture.cjs');
const contentSeed = require('../src/content/__fixtures__/siteContent.json');
const content = {
  ...contentSeed,
  cookieSettings: {...contentSeed.cookieSettings,marketingLabel:'Conținut extern'},
};

// Isolated browser fixtures. These are never stored in CMS or sent to providers.
const payload={providers:[
  {id:'google',href:'https://www.google.com/maps/place/FireArtRo',reviews:[{
    id:'test-google',provider:'google',author:'Autor de test Google',rating:4,
    text:'Recenzie de test pentru verificarea afișării. '.repeat(18),
    published_at:'2026-10-01T12:00:00Z',url:'https://www.google.com/maps/reviews/test-google',
    author_photo_url:'https://lh3.googleusercontent.com/test-avatar',
  }]},
  {id:'facebook',href:'https://www.facebook.com/FireArtRo/reviews',reviews:[{
    id:'test-facebook',provider:'facebook',author:'Autor de test Facebook',rating:null,
    text:'Recomandare de test Facebook fără notă numerică.',
    published_at:'2026-10-02T12:00:00Z',url:'https://www.facebook.com/review/test-facebook',
  }]},
]};

async function openReviews(page,body=payload,status=200){
  await mockConsentLedger(page);
  const revision = {revision_id:'reviews-qa',published_at:'2026-10-01T12:00:00Z'};
  await page.route('**/api/content',route=>route.fulfill({json:{...revision,content}}));
  await page.route('**/api/content/revision',route=>route.fulfill({json:revision}));
  await page.route('**/api/reviews',route=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)}));
  const response=page.waitForResponse(r=>r.url().endsWith('/api/reviews'));
  await page.goto('/contact',{waitUntil:'domcontentloaded'});
  await page.locator('#fireart-intro').waitFor({state:'hidden',timeout:15000});
  const consent=page.getByRole('button',{name:'Doar necesare',exact:true});
  if(await consent.isVisible())await consent.click();
  await page.getByTestId('night-runway-footer').scrollIntoViewIfNeeded();
  await response;
}

async function permitExternalContent(page){
  await page.getByRole('button',{name:'permite conținutul extern',exact:true}).click();
  const dialog=page.getByRole('dialog');
  await dialog.getByRole('checkbox',{name:/Conținut extern/}).check();
  await dialog.getByRole('button',{name:'Salvează preferințele',exact:true}).click();
}

for(const [name,width,height] of [['desktop',1440,900],['phone',390,844]]){
  test(`review sources and long text remain usable: ${name}`,async({page},testInfo)=>{
    await page.setViewportSize({width,height});
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    const avatarRequests=[];
    await page.route('https://lh3.googleusercontent.com/test-avatar',route=>{
      avatarRequests.push(route.request().url());
      return route.fulfill({status:200,contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"/>'});
    });
    await openReviews(page);
    const section=page.getByTestId('home-reviews');
    await expect(section).toBeVisible();
    const google=section.locator('[data-review-provider="google"]');
    const facebook=section.locator('[data-review-provider="facebook"]');
    await expect(section.locator('[data-review-card]')).toHaveCount(1);
    await expect(google.getByRole('link',{name:/Vezi pe Google Maps/})).toBeVisible();
    expect(avatarRequests).toEqual([]);
    await permitExternalContent(page);
    await expect(section.locator('[data-review-card]')).toHaveCount(2);
    await expect.poll(()=>avatarRequests.length).toBeGreaterThan(0);
    await expect(google.getByRole('link',{name:'Vezi recenzia originală pe Google Maps',exact:true})).toHaveAttribute('href',payload.providers[0].reviews[0].url);
    await expect(facebook.getByRole('link',{name:'Vezi recenzia originală pe Facebook',exact:true})).toHaveAttribute('href',payload.providers[1].reviews[0].url);
    await expect(facebook.locator('[data-review-card] .fa-page-reviews__rating')).toHaveCount(0);
    const expandGoogle=google.getByRole('button',{name:'Citește mai mult',exact:true});
    await section.screenshot({path:testInfo.outputPath(`${name}-test-reviews.png`)});
    await expandGoogle.click();
    const googleDialog=page.getByRole('dialog',{name:'Recenzie de pe Google Maps',exact:true});
    await expect(googleDialog).toContainText(payload.providers[0].reviews[0].text.trim());
    await expect(googleDialog.getByRole('link',{name:'Vezi recenzia originală pe Google Maps',exact:true})).toBeVisible();
    const quote=googleDialog.locator('.fa-page-reviews__quote');
    expect(await quote.evaluate(n=>n.scrollHeight-n.clientHeight)).toBeLessThanOrEqual(1);
    await page.screenshot({path:testInfo.outputPath(`${name}-google-review-dialog.png`)});
    await page.keyboard.press('Escape');
    await expect(googleDialog).toHaveCount(0);
    await expect(expandGoogle).toBeFocused();
    const expandFacebook=facebook.getByRole('button',{name:'Citește mai mult',exact:true});
    await expandFacebook.click();
    const facebookDialog=page.getByRole('dialog',{name:'Recenzie de pe Facebook',exact:true});
    await expect(facebookDialog).toContainText(payload.providers[1].reviews[0].text);
    await facebookDialog.getByRole('button',{name:'Închide recenzia',exact:true}).click();
    await expect(expandFacebook).toBeFocused();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width+1);
    expect(await section.locator('[aria-hidden="true"] a:not([tabindex="-1"])').count()).toBe(0);
    expect(errors).toEqual([]);
  });
}

test('a provider without reviews does not hide the available provider',async({page})=>{
  await openReviews(page,{providers:[payload.providers[1]]});
  const section=page.getByTestId('home-reviews');
  await expect(section.locator('[data-review-provider="facebook"]')).toBeVisible();
  await expect(section.locator('[data-review-provider="google"]')).toHaveCount(0);
});

test('unavailable providers leave no empty review section or error on the page',async({page})=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await openReviews(page,{providers:[]},503);
  await expect(page.getByTestId('home-reviews')).toHaveCount(0);
  await expect(page.getByTestId('night-runway-footer')).toBeVisible();
  expect(errors).toEqual([]);
});
