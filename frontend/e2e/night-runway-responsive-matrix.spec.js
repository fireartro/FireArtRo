const { test, expect } = require("@playwright/test");
const seed = require("../src/content/__fixtures__/siteContent.json");

const article = {
  id: "responsive-matrix-article",
  slug: "responsive-matrix-article",
  title: "Un spectacol construit pentru fiecare ecran",
  excerpt: "Din culisele unui spectacol FireArtRo.",
  body: "Primul paragraf.\n\nAl doilea paragraf.",
  category: "Culise",
  cover_media_id: "",
  cover_alt: "",
  status: "published",
  created_at: "2026-09-28T10:00:00Z",
  updated_at: "2026-09-28T10:00:00Z",
  published_at: "2026-09-28T10:00:00Z",
};

const servePublishedContent = async (page) => {
  await page.route("**/api/content", (route) => route.fulfill({
    json: { content: seed, revision_id: "responsive-matrix", published_at: "2026-09-28T00:00:00Z" },
  }));
  await page.route("**/api/content/revision", (route) => route.fulfill({
    json: { revision_id: "responsive-matrix", published_at: "2026-09-28T00:00:00Z" },
  }));
  await page.route("**/api/blog/posts**", (route) => route.fulfill({
    json: new URL(route.request().url()).pathname.endsWith(`/${article.slug}`) ? article : [article],
  }));
};

test.beforeEach(async ({ page }) => servePublishedContent(page));

const viewportMatrix = [
  { name: "phone narrow", width: 320, height: 568 },
  { name: "phone small", width: 375, height: 667 },
  { name: "phone compact", width: 375, height: 812 },
  { name: "phone large", width: 430, height: 932 },
  { name: "phone landscape", width: 667, height: 375 },
  { name: "phone landscape large", width: 844, height: 390 },
  { name: "tablet portrait", width: 768, height: 1024 },
  { name: "tablet landscape", width: 1024, height: 768 },
  { name: "laptop", width: 1366, height: 768 },
  { name: "desktop", width: 1440, height: 900 },
  { name: "MacBook Retina viewport", width: 1512, height: 982 },
  { name: "full HD", width: 1920, height: 1080 },
  { name: "2K", width: 2560, height: 1440 },
  { name: "2K tall", width: 2560, height: 1700 },
  { name: "ultrawide", width: 3440, height: 1440 },
  { name: "4K", width: 3840, height: 2160 },
  { name: "32:9 ultrawide", width: 5120, height: 1440 },
];

const publicRoutes = [
  "/",
  "/galerie",
  "/pachete",
  "/intrebari-frecvente",
  "/contact",
  "/blog",
  `/blog/${article.slug}`,
  "/confidentialitate",
  "/termeni-si-conditii",
  "/cookies",
];

test.describe("FireArt public responsive matrix", () => {
  test("keeps every public route inside every approved viewport", async ({ page }) => {
    test.setTimeout(360_000);

    for (const route of publicRoutes) {
      await page.goto(route, { waitUntil: "domcontentloaded" });
      await expect(page.locator("#fireart-intro"), `${route} loading screen exits`).toHaveCount(0, { timeout: 20_000 });
      await expect(page.locator("main").first(), `${route} main content`).toBeVisible();

      for (const viewport of viewportMatrix) {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.waitForTimeout(80);

        const dimensions = await page.evaluate(() => {
          const main = document.querySelector("main");
          const mainRect = main?.getBoundingClientRect();
          return {
            viewport: document.documentElement.clientWidth,
            page: document.documentElement.scrollWidth,
            mainLeft: mainRect?.left ?? -1,
            mainRight: mainRect?.right ?? Number.POSITIVE_INFINITY,
          };
        });
        const label = `${route} at ${viewport.name} (${viewport.width}x${viewport.height})`;
        expect(dimensions.page, `${label} should not create horizontal page overflow`)
          .toBeLessThanOrEqual(dimensions.viewport + 1);
        expect(dimensions.mainLeft, `${label} main starts inside viewport`).toBeGreaterThanOrEqual(-1);
        expect(dimensions.mainRight, `${label} main ends inside viewport`)
          .toBeLessThanOrEqual(dimensions.viewport + 1);

        const mobileMenu = page.getByTestId("mobile-menu-trigger");
        const desktopLinks = page.locator(".site-navbar-links > a");
        const isMobileNavigation = await mobileMenu.isVisible();
        const isDesktopNavigation = await desktopLinks.first().isVisible();
        expect(isMobileNavigation || isDesktopNavigation, `${label} navigation is available`).toBeTruthy();

        if (isMobileNavigation) {
          const menuBox = await mobileMenu.boundingBox();
          expect(Math.min(menuBox?.width || 0, menuBox?.height || 0), `${label} menu touch target`)
            .toBeGreaterThanOrEqual(44);
        }
      }
    }
  });

  test("keeps critical homepage content visible on touch and landscape layouts", async ({ page }) => {
    const homeViewports = [
      { name: "phone portrait", width: 375, height: 812 },
      { name: "phone landscape", width: 844, height: 390 },
      { name: "tablet portrait", width: 768, height: 1024 },
      { name: "tablet landscape", width: 1024, height: 768 },
    ];

    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.locator("#fireart-intro")).toHaveCount(0, { timeout: 20_000 });
    for (const viewport of homeViewports) {
      await page.setViewportSize(viewport);
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(100);

      const hero = page.getByTestId("hero-section");
      const primaryCta = page.getByTestId("hero-primary-cta");
      const secondaryCta = page.getByTestId("hero-secondary-cta");
      await expect(hero, `${viewport.name} hero`).toBeVisible();
      await expect(primaryCta, `${viewport.name} primary CTA`).toBeVisible();
      await expect(secondaryCta, `${viewport.name} secondary CTA`).toBeVisible();

      for (const locator of [primaryCta, secondaryCta]) {
        const box = await locator.boundingBox();
        expect(box?.x, `${viewport.name} CTA starts inside viewport`).toBeGreaterThanOrEqual(-1);
        expect((box?.x || 0) + (box?.width || 0), `${viewport.name} CTA ends inside viewport`)
          .toBeLessThanOrEqual(viewport.width + 1);
      }

      for (const section of ["home-gallery", "home-about", "home-partners", "home-brief"]) {
        const locator = page.getByTestId(section);
        await locator.evaluate((element) => element.scrollIntoView({ block: "center" }));
        await page.waitForTimeout(80);
        await expect(locator, `${viewport.name} ${section}`).toBeVisible();
      }
    }
  });

  test("DPR 2 keeps the same CSS geometry at desktop and phone widths", async ({ browser }) => {
    test.setTimeout(60_000);
    for (const viewport of [{ width: 2560, height: 1440 }, { width: 390, height: 844 }]) {
      const results = [];
      for (const deviceScaleFactor of [1, 2]) {
        const context = await browser.newContext({ viewport, deviceScaleFactor });
        try {
          const page = await context.newPage();
          await servePublishedContent(page);
          await page.goto(process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:4173/", { waitUntil: "domcontentloaded" });
          await expect(page.locator("#fireart-intro")).toHaveCount(0, { timeout: 20_000 });
          await expect(page.getByTestId("hero-section")).toBeVisible();
          results.push(await page.evaluate(() => ({
            bodySize: Number.parseFloat(getComputedStyle(document.body).fontSize),
            heroWidth: document.querySelector(".nr-hero__content").getBoundingClientRect().width,
            titleWidth: document.querySelector(".nr-hero__title").getBoundingClientRect().width,
            viewportWidth: document.documentElement.clientWidth,
            overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
            dpr: window.devicePixelRatio,
          })));
        } finally {
          await context.close();
        }
      }
      expect(results.map((result) => result.dpr)).toEqual([1, 2]);
      for (const key of ["bodySize", "heroWidth", "titleWidth", "viewportWidth"]) {
        expect(Math.abs(results[0][key] - results[1][key]), `${viewport.width}px ${key} DPR parity`).toBeLessThanOrEqual(1);
      }
      expect(results.every((result) => result.overflow <= 1), `${viewport.width}px no DPR overflow`).toBe(true);
    }
  });
});
