const { test, expect } = require("@playwright/test");

const routeDesigns = [
  ["/", "night-runway"],
  ["/pachete", "night-runway"],
  ["/galerie", "night-runway"],
  ["/intrebari-frecvente", "night-runway"],
  ["/contact", "night-runway"],
];

for (const [route, design] of routeDesigns) {
  test(`${route} uses the Night Runway design contract`, async ({ page }) => {
    await page.goto(route, { waitUntil: "domcontentloaded" });
    await expect(page.locator(`main[data-design='${design}']`)).toBeVisible();

    const dimensions = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      page: document.documentElement.scrollWidth,
    }));
    expect(dimensions.page).toBeLessThanOrEqual(dimensions.viewport + 1);

    await expect(page.locator("[data-testid='main-navbar']")).toBeVisible();
    await expect(page.locator("[data-testid='nav-logo'] img")).toBeVisible();
  });
}

test("landing plays the responsive cinematic hero media and social controls", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const heroVideo = page.locator("[data-testid='hero-section'] video");
  await expect(heroVideo).toHaveCount(1);
  await expect.poll(() => heroVideo.evaluate((node) => node.currentSrc)).toMatch(/fireart-hero-wide\.mp4/);
  await expect(page.locator("[data-testid='hero-primary-cta']")).toBeVisible();
  await expect(page.locator("[data-testid='hero-primary-cta']")).toHaveCSS("min-height", /4[4-9]px|[5-9]\dpx/);
  await expect(page.locator("[data-testid='social-dock'], .social-dock").first()).toBeAttached();
});

test("switches hero video source when a tablet rotates", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 1366 });
  await page.goto("/", { waitUntil: "domcontentloaded" });

  const heroVideo = page.locator("[data-testid='hero-section'] video");
  await expect.poll(() => heroVideo.evaluate((node) => node.currentSrc)).toMatch(/fireart-hero-tablet-portrait\.mp4/);

  await page.setViewportSize({ width: 1366, height: 1024 });
  await expect.poll(() => heroVideo.evaluate((node) => node.currentSrc)).toMatch(/fireart-hero-tablet-landscape\.mp4/);
});

test("keyboard users receive a visible focus treatment", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.keyboard.press("Tab");
  const focused = page.locator(":focus-visible");
  await expect(focused).toBeVisible();
  const outline = await focused.evaluate((node) => getComputedStyle(node).outlineStyle);
  expect(outline).not.toBe("none");
});

test("contact uses the shared Night Glass form and secondary direct actions", async ({ page }) => {
  await page.goto("/contact", { waitUntil: "domcontentloaded" });

  const form = page.locator(".nr-contact-form-wrap");
  const actions = page.locator(".nr-contact-direct a");
  const rail = page.getByTestId("contact-form-rail");

  await expect(form).toHaveCSS("border-radius", "0px");
  await expect(form).not.toHaveCSS("clip-path", "none");
  await expect(rail).toHaveCSS("height", "1px");
  await expect(rail).toHaveCSS("background-image", /linear-gradient/);
  await expect(actions).toHaveCount(3);
  for (const action of await actions.all()) {
    await expect(action).toHaveClass(/nr-button--secondary/);
    await expect(action).toHaveCSS("min-height", /4[4-9]px|[5-9]\dpx/);
  }

  await expect(page.locator("#quote-event-type")).toBeVisible();
  await expect(page.locator("#quote-email")).toBeVisible();
  await expect(page.locator("#quote-consent")).toBeVisible();
  await expect(page.getByRole("button", { name: /Trimite cererea/i })).toBeVisible();
});

test("footer keeps legal controls but omits the public company and CUI string", async ({ page }) => {
  await page.goto("/contact", { waitUntil: "domcontentloaded" });

  const footer = page.locator("footer.fa-footer");
  const bottom = footer.locator(".fa-footer__bottom");

  await expect(footer).not.toContainText("1A BEST EVENTS SRL");
  await expect(footer).not.toContainText("RO37037033");
  await expect(bottom.locator(":scope > span")).toHaveCount(1);
  await expect(bottom).toContainText(`© ${new Date().getFullYear()} FireArtRo`);
  await expect(bottom.locator(".fa-footer__legal a")).toHaveCount(5);
  await expect(bottom.getByRole("button", { name: "Setări cookies" })).toBeVisible();
});

test("contact keeps the footer at the bottom of a tall tablet viewport", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 1366 });
  await page.goto("/contact", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".nr-contact-page .fa-footer")).toBeVisible();

  const layout = await page.evaluate(() => {
    const footer = document.querySelector(".nr-contact-page .fa-footer");
    const rect = footer?.getBoundingClientRect();
    return {
      footerBottom: rect ? rect.bottom : 0,
      viewportHeight: window.innerHeight,
    };
  });

  expect(layout.footerBottom).toBeGreaterThanOrEqual(layout.viewportHeight - 1);
});

test("mobile menu trigger is a transparent three-line control", async ({ page }) => {
  await page.setViewportSize({ width: 467, height: 872 });
  await page.goto("/", { waitUntil: "domcontentloaded" });

  const trigger = page.getByTestId("mobile-menu-trigger");
  await expect(trigger).toBeVisible();
  await expect(trigger).toHaveCSS("border-width", "0px");
  await expect(trigger).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await expect(trigger.locator("svg")).toHaveCount(0);
  await expect(trigger.locator(".menu-button__line")).toHaveCount(3);
  for (const line of await trigger.locator(".menu-button__line").all()) {
    await expect(line).toHaveCSS("background-color", "rgb(255, 255, 255)");
  }
});

test("uses CSS viewport dimensions independently of Retina pixel density", async ({ browser, baseURL }) => {
  const layouts = [];
  for (const deviceScaleFactor of [1, 2, 3]) {
    const context = await browser.newContext({
      viewport: { width: 1512, height: 982 }, deviceScaleFactor, reducedMotion: "reduce",
    });
    try {
      const page = await context.newPage();
      await page.goto(baseURL, { waitUntil: "domcontentloaded" });
      await expect(page.getByTestId("hero-primary-cta")).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      layouts.push(await page.evaluate(() => ({
        viewport: innerWidth,
        titleSize: getComputedStyle(document.querySelector(".nr-hero__title")).fontSize,
        shellWidth: document.querySelector(".nr-hero__content").clientWidth,
        heroHeight: document.querySelector("#acasa").clientHeight,
      })));
    } finally {
      await context.close();
    }
  }
  expect(layouts[1]).toEqual(layouts[0]);
  expect(layouts[2]).toEqual(layouts[0]);
});

test("keeps every public layout fluid, centered and free of horizontal overflow", async ({ page }) => {
  // This intentionally exercises 121 route/viewport combinations on one page.
  test.setTimeout(300_000);
  const viewports = [
    [375, 812],
    [430, 932],
    [768, 1024],
    [1366, 768],
    [1440, 900],
    [1512, 982],
    [1920, 1080],
    [2560, 1440],
    [3440, 1440],
    [3840, 2160],
    [5120, 1440],
  ];
  const routes = [
    "/",
    "/pachete",
    "/galerie",
    "/intrebari-frecvente",
    "/contact",
    "/blog",
    "/blog/responsive-check",
    "/confidentialitate",
    "/termeni-si-conditii",
    "/cookies",
    "/admin",
  ];

  const post = {
    id: "responsive-check", slug: "responsive-check", title: "Spectacole care rămân în amintire",
    excerpt: "Din culisele unui spectacol cu drone și artificii.", category: "Evenimente",
    body: `Un articol cu un link lung: https://example.com/${"spectacol".repeat(18)}`,
    status: "published", published_at: "2026-08-30T10:00:00Z",
  };
  await page.route("**/api/blog/posts**", (route) => route.fulfill({
    contentType: "application/json",
    body: JSON.stringify(new URL(route.request().url()).pathname.endsWith("/responsive-check") ? post : [post]),
  }));

  for (const [width, height] of viewports) {
    await page.setViewportSize({ width, height });

    for (const route of routes) {
      await page.goto(route, { waitUntil: "domcontentloaded" });
      await expect(page.locator("main").first()).toBeVisible();
      if (route === "/blog/responsive-check") await expect(page.getByTestId("blog-body")).toBeVisible();

      const layout = await page.evaluate(() => {
        const root = document.documentElement;
        const viewportWidth = root.clientWidth;
        const anchors = [
          document.querySelector("main"),
          document.querySelector(".site-navbar"),
          document.querySelector(".nr-hero__content"),
          document.querySelector(".nr-package-comparator__shell"),
          document.querySelector(".nr-gallery-stage__shell"),
          document.querySelector(".nr-faq-hero__inner"),
          document.querySelector(".nr-contact-layout"),
          document.querySelector(".fa-blog-hero .nr-shell"),
          document.querySelector(".legal-hero-inner"),
          document.querySelector(".legal-layout"),
          document.querySelector(".fa-blog-body"),
          document.querySelector(".admin-main"),
        ].filter(Boolean);
        const overflowingAnchors = anchors
          .map((node) => {
            const rect = node.getBoundingClientRect();
            return { className: node.className, left: rect.left, right: rect.right };
          })
          .filter(({ left, right }) => left < -1 || right > viewportWidth + 1);
        const shellWidths = [...document.querySelectorAll(".nr-shell:not(.nr-hero__content)")]
          .map((node) => node.getBoundingClientRect().width)
          .filter((value) => value > 0);
        const readingOverflow = [...document.querySelectorAll(".fa-blog-body p")]
          .some((node) => node.scrollWidth > node.clientWidth + 1);
        const edgeToEdgeFaq = [...document.querySelectorAll(".nr-faq-hero__inner, .nr-faq__layout")]
          .some((node) => node.getBoundingClientRect().left < 15);

        return {
          pageOverflow: root.scrollWidth - viewportWidth,
          overflowingAnchors,
          widestShell: shellWidths.length ? Math.max(...shellWidths) : 0,
          readingOverflow,
          edgeToEdgeFaq,
        };
      });

      expect(layout.pageOverflow, `${route} page overflow at ${width}x${height}`).toBeLessThanOrEqual(1);
      expect(layout.overflowingAnchors, `${route} anchor overflow at ${width}x${height}`).toEqual([]);
      expect(layout.readingOverflow, `${route} readable article at ${width}x${height}`).toBe(false);
      expect(layout.edgeToEdgeFaq, `${route} content gutters at ${width}x${height}`).toBe(false);
      if (width >= 1920 && layout.widestShell) {
        expect(layout.widestShell, `${route} constrained content at ${width}x${height}`).toBeLessThanOrEqual(1441);
      }
    }
  }
});
