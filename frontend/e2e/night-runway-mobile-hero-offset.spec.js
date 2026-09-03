const { test, expect } = require("@playwright/test");

test("gives the mobile hero copy clear space below the navigation", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/", { waitUntil: "domcontentloaded" });

  const necessaryCookies = page.getByRole("button", { name: "Doar necesare" });
  if (await necessaryCookies.isVisible()) {
    await necessaryCookies.click();
  }

  const eyebrow = page.locator(".nr-hero__eyebrow");
  const title = page.locator(".nr-hero__title");
  const primaryCta = page.getByTestId("hero-primary-cta");

  await expect(eyebrow).toBeVisible();
  await expect(title).toBeVisible();
  await expect(primaryCta).toBeVisible();

  const eyebrowBox = await eyebrow.boundingBox();
  const titleBox = await title.boundingBox();
  const primaryCtaBox = await primaryCta.boundingBox();
  const navigationBox = await page.getByTestId("main-navbar").boundingBox();

  expect(eyebrowBox.y - navigationBox.y - navigationBox.height).toBeGreaterThanOrEqual(24);
  expect(titleBox?.y).toBeGreaterThan(eyebrowBox?.y || 0);
  expect(primaryCtaBox?.y).toBeGreaterThan(titleBox?.y || 0);
  expect(primaryCtaBox.y + primaryCtaBox.height).toBeLessThanOrEqual(844 - 60);

  await page.screenshot({ path: testInfo.outputPath("mobile-hero-copy-lowered.png") });
});
