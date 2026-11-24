const {test,expect}=require('@playwright/test');
const { mockConsentLedger } = require('./consent-fixture.cjs');
const contentSeed = require('../src/content/__fixtures__/siteContent.json');
const widgetUrl = 'https://5cd3630c2af747e78e24cbbda99bf22a.elf.site';
const content = {
  ...contentSeed,
  reviewSettings: {...contentSeed.reviewSettings,description:''},
  cookieSettings: {...contentSeed.cookieSettings,marketingLabel:'Conținut extern'},
  legalPages: {
    ...contentSeed.legalPages,
    terms: {
      ...contentSeed.legalPages.terms,
      sections: [...contentSeed.legalPages.terms.sections, {
        id:'terms-section-8',heading:'Materiale și recenzii',
        paragraphs:['FireArtRo nu verifică independent dacă autorii au cumpărat sau au folosit serviciile.'],
      }],
    },
  },
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
    await expect(facebook.getByRole('link',{name:/Adaugă recenzie pe Facebook/})).toHaveCSS('border-radius','999px');
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
    await expect(googleDialog.getByRole('button',{name:'Închide recenzia',exact:true})).toHaveCSS('border-radius','50%');
    const source=googleDialog.getByRole('link',{name:'Vezi recenzia originală pe Google Maps',exact:true});
    await source.scrollIntoViewIfNeeded();
    await expect(source).toBeInViewport();
    await expect(googleDialog.getByRole('button',{name:'Închide recenzia',exact:true})).toBeInViewport();
    const quote=googleDialog.locator('.fa-page-reviews__quote');
    await expect(quote).toHaveCSS('display','block');
    expect(await quote.evaluate(element=>{
      const range=document.createRange();
      range.selectNodeContents(element);
      const lastLine=Array.from(range.getClientRects()).at(-1);
      const card=element.closest('blockquote').getBoundingClientRect();
      return lastLine && lastLine.top >= card.top-1 && lastLine.bottom <= card.bottom+1;
    })).toBe(true);
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

test('Facebook fallback at the end of Contact respects consent and links to the legal notice',async({page})=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.route(`${widgetUrl}/**`,route=>route.fulfill({
    contentType:'text/html',
    body:`<p>Widget Facebook de test</p><script>
      window.addEventListener('message', event => {
        if (event.source === window.parent && event.data?.type === 'fireart:check-review-ready') {
          window.parent.postMessage({type:'fireart:review-ready'}, event.origin);
        }
      });
    </script>`,
  }));
  await openReviews(page,{providers:[]},503);
  const reviews=page.getByTestId('home-reviews');
  await expect(reviews.locator('iframe')).toHaveCount(0);
  await expect(reviews.getByRole('link',{name:/Adaugă recenzie pe Facebook/})).toBeVisible();
  await expect(reviews).not.toContainText('nu verifică independent');
  await permitExternalContent(page);
  await expect(reviews.locator('iframe')).toHaveAttribute('src',widgetUrl);
  await expect(reviews.locator('[data-widget-state="ready"] iframe')).toBeVisible();
  await reviews.getByRole('link',{name:'Sursă și verificare',exact:true}).click();
  await expect(page).toHaveURL(/\/termeni-si-conditii#terms-section-8$/);
  const policy=page.locator('#terms-section-8');
  await expect(policy.getByRole('heading',{name:'Materiale și recenzii'})).toBeInViewport();
  await expect(policy).toContainText('nu verifică independent');
  await expect(page.getByTestId('night-runway-footer')).toBeVisible();
  expect(errors).toEqual([]);
});

test('a blocked Facebook embed leaves a readable link instead of a browser error panel',async({page})=>{
  await page.route(`${widgetUrl}/**`,route=>route.fulfill({
    contentType:'text/html', headers:{'x-frame-options':'DENY'}, body:'Blocked test frame',
  }));
  await openReviews(page,{providers:[]},503);
  await permitExternalContent(page);
  const reviews=page.getByTestId('home-reviews');
  await expect(reviews.locator('iframe')).toBeHidden();
  await expect(reviews.getByRole('link',{name:'Vezi recenziile pe Facebook',exact:true}))
    .toHaveAttribute('href','https://www.facebook.com/FireArtRo/reviews');
  await expect(reviews.getByRole('status')).toHaveText('Recenziile Facebook nu sunt disponibile aici momentan.',{timeout:15000});
  await expect(reviews.locator('iframe')).toHaveCount(0);
});
