const { test, expect } = require("@playwright/test");

const responsiveViewports = [
  { width: 1440, height: 900 },
  { width: 1024, height: 768 },
  { width: 430, height: 932 },
  { width: 568, height: 320 },
];

test.describe("Night Runway package stage", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("fireartro-cookie-consent-v1", JSON.stringify({
        necessary: true,
        analytics: false,
        marketing: false,
        savedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + (180 * 86_400_000)).toISOString(),
      }));
    });
    await page.goto("/pachete", { waitUntil: "domcontentloaded" });
  });

  test("uses one compact studio reel instead of a framed configurator", async ({ page }) => {
    await expect(page.locator("main[data-design='night-runway']")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: "Pachete" })).toBeVisible();
    await expect(page.getByTestId("package-comparator")).toBeVisible();
    await expect(page.getByTestId("package-stage")).toBeVisible();
    await expect(page.getByTestId("package-media")).toBeVisible();
    await expect(page.getByTestId("package-variant-strip")).toBeVisible();
    await expect(page.getByTestId("package-transition-band")).toHaveCount(0);
    await expect(page.locator("[data-variant-tile]")).not.toHaveCount(0);

    await expect(page.getByTestId("packages-hero")).toHaveCount(0);
    await expect(page.getByTestId("packages-flight-plan")).toHaveCount(0);
    await expect(page.getByTestId("packages-comparison")).toHaveCount(0);
    await expect(page.locator(".package-editorial-grid, .package-editorial-card")).toHaveCount(0);
    await expect(page.locator("body")).not.toContainText(/plan de zbor|flight|telemetrie/i);
  });

  test("keeps selectable package previews directly above the selected package on desktop", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.reload({ waitUntil: "domcontentloaded" });

    const rail = page.getByTestId("package-variant-strip");
    const media = page.getByTestId("package-media");
    const railBox = await rail.boundingBox();
    const mediaBox = await media.boundingBox();

    expect(railBox?.y).toBeLessThan(mediaBox?.y || 0);
    expect((mediaBox?.y || 0) - ((railBox?.y || 0) + (railBox?.height || 0))).toBeLessThan(40);
  });

  test("lists package names before the active preview on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 467, height: 872 });
    await page.reload({ waitUntil: "domcontentloaded" });

    const stage = page.getByTestId("package-stage");
    const rail = page.getByTestId("package-variant-strip");
    const stageBox = await stage.boundingBox();
    const railBox = await rail.boundingBox();

    expect(railBox?.y).toBeLessThan(stageBox?.y || 0);
    await expect(rail.locator("img")).toHaveCount(0);
  });

  test("opens the selected package preview in an expanded video dialog", async ({ page }) => {
    await page.getByTestId("package-media").getByRole("button").click();

    const dialog = page.getByTestId("package-video-dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.locator("iframe")).toHaveAttribute("src", /youtube-nocookie/);
  });

  test("keeps the full preview and close control inside rotated viewports", async ({ page }) => {
    await page.getByTestId("package-media").getByRole("button").click();
    const dialog = page.getByTestId("package-video-dialog");
    for (const [width, height] of [[375, 812], [844, 390], [568, 320], [1024, 600], [1512, 982], [5120, 1440]]) {
      await page.setViewportSize({ width, height });
      await expect.poll(() => dialog.evaluate((node) => {
        const rect = node.getBoundingClientRect();
        const close = node.querySelector(":scope > button").getBoundingClientRect();
        return rect.top >= 0 && rect.bottom <= innerHeight && rect.left >= 0 && rect.right <= innerWidth
          && close.top >= 0 && close.bottom <= innerHeight && close.height >= 44;
      }), { message: `preview framing at ${width}x${height}` }).toBe(true);
    }
  });

  test("offers a dedicated custom quote path for Drone show", async ({ page }) => {
    const categories = page.getByRole("tablist", { name: "Categorii de spectacol" });
    await categories.getByRole("tab", { name: "Show drone" }).click();

    const droneQuote = page.getByTestId("drone-show-quote");
    await expect(droneQuote).toBeVisible();
    await expect(droneQuote).toContainText("Ofertă personalizată");

    await page.route("**/contact", (route) => route.fulfill({
      status: 200,
      contentType: "text/html",
      body: "<!doctype html><html><body>Contact test</body></html>",
    }));
    await Promise.all([
      page.waitForURL("**/contact", { waitUntil: "domcontentloaded" }),
      page.getByTestId("drone-show-quote-cta").click(),
    ]);

    const selection = await page.evaluate(() => (
      JSON.parse(window.sessionStorage.getItem("fireartro-contact-prefill") || "{}")
    ));
    expect(selection).toEqual({ services: ["Show drone"] });
  });

  test("keeps the active video in a true widescreen editorial frame", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.reload({ waitUntil: "domcontentloaded" });

    const media = page.getByTestId("package-media");
    const box = await media.boundingBox();
    const ratio = box.width / box.height;
    expect(ratio).toBeGreaterThan(1.7);
    expect(ratio).toBeLessThan(1.82);
    expect(box.height).toBeLessThan(560);

    const headingBox = await page.getByRole("heading", { level: 1, name: "Pachete" }).boundingBox();
    expect(headingBox.height).toBeLessThan(70);
  });

  test("uses the matching YouTube thumbnail before a package video is opened", async ({ page }) => {
    const media = page.locator(".nr-package-stage__media img");
    const categories = page.getByRole("tablist", { name: "Categorii de spectacol" }).getByRole("tab");
    await expect(categories).not.toHaveCount(0);
    let inspectedPackages = 0;

    for (let categoryIndex = 0; categoryIndex < await categories.count(); categoryIndex += 1) {
      await categories.nth(categoryIndex).click();

      const variants = page.getByRole("tablist", { name: /Variante pentru/ }).getByRole("tab");
      for (let variantIndex = 0; variantIndex < await variants.count(); variantIndex += 1) {
        await variants.nth(variantIndex).click();
        await expect(media).toHaveAttribute("src", /https:\/\/i\.ytimg\.com\/vi\/.+\/hqdefault\.jpg/);
        inspectedPackages += 1;
      }
    }

    expect(inspectedPackages).toBe(8);
  });

  test("replaces a stale Admin package catalog with the current YouTube previews", async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("fireartro-managed-content-v1", JSON.stringify({
        packageCatalogVersion: "fireworks-2026-v2",
        packages: [{
          id: "fireworks-bronze-2026",
          title: "Bronze",
          category: "Artificii de noapte",
          image: "/media/fireworks-sky.webp",
          videoUrl: "",
        }],
      }));
    });
    await page.reload({ waitUntil: "domcontentloaded" });

    await page
      .getByRole("tablist", { name: "Categorii de spectacol" })
      .getByRole("tab", { name: "Artificii de noapte" })
      .click();
    await expect(page.getByTestId("packages-active-title")).toHaveText("Bronze");
    await expect(page.locator(".nr-package-stage__media img")).toHaveAttribute(
      "src",
      "https://i.ytimg.com/vi/j2BGRd88qBc/hqdefault.jpg",
    );
  });

  test("compares categories and variants with keyboard-safe controls", async ({ page }) => {
    const categories = page.getByRole("tablist", { name: "Categorii de spectacol" });
    await expect(categories.getByRole("tab")).toHaveCount(4);
    await expect(categories.getByRole("tab", { name: "Artificii de zi" })).toHaveAttribute("aria-selected", "true");

    await categories.getByRole("tab", { name: "Artificii de noapte" }).click();
    const variants = page.getByRole("tablist", { name: "Variante pentru Artificii de noapte" });
    await expect(variants.getByRole("tab")).toHaveCount(6);
    await expect(page.getByTestId("packages-active-title")).toHaveText("Bronze");

    const firstVariant = variants.getByRole("tab", { name: /Bronze/ });
    await firstVariant.focus();
    await page.keyboard.press("ArrowRight");
    await expect(variants.getByRole("tab", { name: /Silver/ })).toBeFocused();
    await expect(page.getByTestId("packages-active-title")).toHaveText("Silver");

    await categories.getByRole("tab", { name: "Efecte speciale" }).click();
    await expect(page.getByRole("tablist", { name: "Variante pentru Efecte speciale" }).getByRole("tab")).toHaveCount(1);
    await expect(page.getByTestId("packages-active-title")).toHaveText("Mix");
  });

  test("runs a short media-only transition when the active variant changes", async ({ page }) => {
    const stage = page.getByTestId("package-stage");
    await page.getByRole("tab", { name: "Artificii de noapte" }).click();
    await expect(page.getByTestId("packages-active-title")).toHaveText("Bronze");
    const silver = page.getByRole("tab", { name: /Silver/ });

    await silver.click();
    await expect(stage).toHaveAttribute("data-transition-state", "swap");
    await expect(page.getByTestId("packages-active-title")).toHaveText("Silver");
    await expect(stage).toHaveAttribute("data-transition-state", "idle");
  });

  test("switches instantly when reduced motion is requested", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.reload({ waitUntil: "domcontentloaded" });

    await page.getByRole("tab", { name: "Artificii de noapte" }).click();
    await page.getByRole("tab", { name: /Silver/ }).click();
    await expect(page.getByTestId("packages-active-title")).toHaveText("Silver");
    await expect(page.getByTestId("package-stage")).toHaveAttribute("data-transition-state", "idle");
  });

  test("keeps the selected package contract when opening contact", async ({ page }) => {
    await page.getByRole("tab", { name: "Artificii de noapte" }).click();
    await page.getByRole("tab", { name: /Silver/ }).click();
    await expect(page.getByTestId("packages-active-title")).toHaveText("Silver");

    await page.route("**/contact", (route) => route.fulfill({
      status: 200,
      contentType: "text/html",
      body: "<!doctype html><html><body>Contact test</body></html>",
    }));
    await Promise.all([
      page.waitForURL("**/contact", { waitUntil: "domcontentloaded" }),
      page.getByTestId("packages-direct-cta").click(),
    ]);

    const selection = await page.evaluate(() => (
      JSON.parse(window.sessionStorage.getItem("fireartro-contact-prefill") || "{}")
    ));
    expect(selection).toEqual({
      package_id: "fireworks-silver-2026",
      package_title: "Silver",
      services: ["Artificii de noapte"],
    });
  });

  test("fits the complete package reel inside a common laptop viewport", async ({ page }) => {
    await page.setViewportSize({ width: 1211, height: 1041 });
    await page.reload({ waitUntil: "domcontentloaded" });

    const headerBox = await page.locator(".nr-package-comparator__header").boundingBox();
    const mediaBox = await page.getByTestId("package-media").boundingBox();
    const variantsBox = await page.getByTestId("package-variant-strip").boundingBox();

    expect(headerBox?.y).toBeLessThanOrEqual(150);
    expect(mediaBox?.height).toBeLessThanOrEqual(350);
    expect((variantsBox?.y || 0) + (variantsBox?.height || 0)).toBeLessThanOrEqual(1041);
  });

  for (const viewport of responsiveViewports) {
    test(`stays compact and usable at ${viewport.width}x${viewport.height}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.reload({ waitUntil: "domcontentloaded" });

      const dimensions = await page.evaluate(() => ({
        viewport: document.documentElement.clientWidth,
        document: document.documentElement.scrollWidth,
      }));
      expect(dimensions.document, `${viewport.width}x${viewport.height}`).toBeLessThanOrEqual(dimensions.viewport + 1);

      const categoryTab = page.getByRole("tablist", { name: "Categorii de spectacol" }).getByRole("tab").first();
      const variantTab = page.getByRole("tablist", { name: "Variante pentru Artificii de zi" }).getByRole("tab").first();
      const directCta = page.getByTestId("packages-direct-cta");

      for (const control of [categoryTab, variantTab, directCta]) {
        const box = await control.boundingBox();
        expect(box?.height, `${viewport.width}x${viewport.height}`).toBeGreaterThanOrEqual(44);
      }

      await expect(page.getByTestId("package-stage")).toBeVisible();
      await expect(page.getByTestId("package-media")).toBeVisible();
      await expect(page.getByTestId("package-variant-strip")).toBeVisible();
      await expect(directCta).toBeVisible();

      const mediaBox = await page.getByTestId("package-media").boundingBox();
      const mediaRatio = mediaBox.width / mediaBox.height;
      expect(mediaRatio, `${viewport.width}x${viewport.height}`).toBeGreaterThan(1.68);
      expect(mediaRatio, `${viewport.width}x${viewport.height}`).toBeLessThan(1.84);
    });
  }
});
