const { test, expect } = require("@playwright/test");

const consent = {
  version: 2,
  necessary: true,
  analytics: false,
  marketing: false,
  savedAt: new Date().toISOString(),
  expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
};

test.describe("FireArt visual smoke", () => {
  test("renders a clean hero and anonymous About section", async ({ page }, testInfo) => {
    await page.addInitScript((storedConsent) => {
      window.localStorage.setItem("fireartro-cookie-consent-v1", JSON.stringify(storedConsent));
    }, consent);

    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("cookie-consent")).toHaveCount(0);
    await expect(page.locator("#acasa")).toBeVisible();
    await page.waitForTimeout(700);
    await page.screenshot({ path: testInfo.outputPath("hero.png"), fullPage: false });

    const about = page.getByTestId("home-about");
    await about.scrollIntoViewIfNeeded();
    await expect(about).toHaveAttribute("id", "intro");
    await expect(about.locator("[data-team-person], [data-team-cutout]")).toHaveCount(0);
    await page.screenshot({ path: testInfo.outputPath("about.png"), fullPage: false });
  });
});
