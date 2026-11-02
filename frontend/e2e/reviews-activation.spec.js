const {test,expect}=require('@playwright/test');

// Isolated browser fixtures. These are never stored in CMS or sent to providers.
const payload={providers:[
  {id:'google',href:'https://www.google.com/maps/place/FireArtRo',reviews:[{
    id:'test-google',provider:'google',author:'Autor de test Google',rating:4,
    text:'Recenzie de test pentru verificarea afișării. '.repeat(18),
    published_at:'2026-10-01T12:00:00Z',url:'https://www.google.com/maps/reviews/test-google',
  }]},
  {id:'facebook',href:'https://www.facebook.com/FireArtRo/reviews',reviews:[{
    id:'test-facebook',provider:'facebook',author:'Autor de test Facebook',rating:null,
    text:'Recomandare de test Facebook fără notă numerică.',
    published_at:'2026-10-02T12:00:00Z',url:'https://www.facebook.com/review/test-facebook',
  }]},
]};

async function openReviews(page,body=payload,status=200){
  await page.route('**/api/reviews',route=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)}));
  const response=page.waitForResponse(r=>r.url().endsWith('/api/reviews'));
  await page.goto('/contact',{waitUntil:'domcontentloaded'});
  await page.locator('#fireart-intro').waitFor({state:'hidden',timeout:15000});
  const consent=page.getByRole('button',{name:'Doar necesare',exact:true});
  if(await consent.isVisible())await consent.click();
  await page.getByTestId('night-runway-footer').scrollIntoViewIfNeeded();
  await response;
}

for(const [name,width,height] of [['desktop',1440,900],['phone',390,844]]){
  test(`review sources and long text remain usable: ${name}`,async({page},testInfo)=>{
    await page.setViewportSize({width,height});
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await openReviews(page);
    const section=page.getByTestId('home-reviews');
    await expect(section).toBeVisible();
    await expect(section.locator('[data-review-card]')).toHaveCount(2);
    const google=section.locator('[data-review-provider="google"]');
    const facebook=section.locator('[data-review-provider="facebook"]');
    await expect(google.getByRole('link',{name:'Vezi recenzia originală pe Google Maps',exact:true})).toHaveAttribute('href',payload.providers[0].reviews[0].url);
    await expect(facebook.getByRole('link',{name:'Vezi recenzia originală pe Facebook',exact:true})).toHaveAttribute('href',payload.providers[1].reviews[0].url);
    await expect(facebook.locator('[data-review-card] .fa-page-reviews__rating')).toHaveCount(0);
    const card=google.locator('[data-review-card]');
    await expect(card).toContainText(payload.providers[0].reviews[0].text.trim());
    const textBounds=await card.locator('p').evaluate(n=>({scroll:n.scrollHeight,height:n.clientHeight,clamp:getComputedStyle(n).webkitLineClamp}));
    expect(textBounds.scroll).toBeLessThanOrEqual(textBounds.height+1);
    expect(textBounds.clamp).toBe('none');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width+1);
    expect(await section.locator('[aria-hidden="true"] a:not([tabindex="-1"])').count()).toBe(0);
    expect(errors).toEqual([]);
    await section.screenshot({path:testInfo.outputPath(`${name}-test-reviews.png`)});
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
