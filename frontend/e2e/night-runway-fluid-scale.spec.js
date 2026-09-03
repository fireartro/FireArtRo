const { expect, test } = require("@playwright/test");

const scaleCases = [
  { width: 1512, height: 982, navMin: 12, bodyMin: 14, heroTitleMin: 72, galleryTitleMin: 52, shellMin: 1300 },
  { width: 2560, height: 1440, navMin: 15, bodyMin: 16, heroTitleMin: 104, galleryTitleMin: 88, shellMin: 1400 },
  { width: 3840, height: 2160, navMin: 18, bodyMin: 18, heroTitleMin: 128, galleryTitleMin: 128, shellMin: 1400 },
  { width: 5120, height: 1440, navMin: 18, bodyMin: 18, heroTitleMin: 128, galleryTitleMin: 128, shellMin: 1400 },
];

test("large viewports retain deliberate visual scale without stretching readable content", async ({ page }) => {
  await page.goto("/#acasa", { waitUntil: "domcontentloaded" });

  for (const viewport of scaleCases) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(100);

    const metrics = await page.evaluate(() => {
      const number = (selector) => {
        const node = document.querySelector(selector);
        if (!node) throw new Error(`Missing scale probe: ${selector}`);
        return Number.parseFloat(getComputedStyle(node).fontSize);
      };
      const shell = document.querySelector(".fa-packages .nr-shell");
      if (!shell) throw new Error("Missing representative layout shell");

      return {
        nav: number(".site-navbar-links > a"),
        body: Number.parseFloat(getComputedStyle(document.body).fontSize),
        heroTitle: number(".nr-hero__title"),
        galleryTitle: number(".fa-work__intro h2"),
        shellWidth: shell.getBoundingClientRect().width,
        viewportWidth: window.innerWidth,
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    });

    const label = `${viewport.width}x${viewport.height}`;
    expect(metrics.nav, `${label} navigation`).toBeGreaterThanOrEqual(viewport.navMin);
    expect(metrics.body, `${label} body`).toBeGreaterThanOrEqual(viewport.bodyMin);
    expect(metrics.heroTitle, `${label} hero title`).toBeGreaterThanOrEqual(viewport.heroTitleMin);
    expect(metrics.galleryTitle, `${label} gallery title`).toBeGreaterThanOrEqual(viewport.galleryTitleMin);
    expect(metrics.shellWidth, `${label} layout shell minimum`).toBeGreaterThanOrEqual(viewport.shellMin);
    expect(metrics.shellWidth, `${label} readable layout maximum`).toBeLessThanOrEqual(1441);
    expect(metrics.overflow, `${label} horizontal overflow`).toBeLessThanOrEqual(1);
  }
});

const publicScaleProbes = [
  {
    route: "/pachete",
    heading: ".nr-package-comparator h1",
    body: ".nr-package-stage__copy > span",
    feature: ".nr-package-stage__media",
    featureMin: 700,
  },
  {
    route: "/galerie",
    heading: ".nr-gallery-header h1",
    body: ".nr-gallery-header__intro",
    feature: ".nr-gallery-stage__shell",
    featureMin: 1200,
  },
  {
    route: "/intrebari-frecvente",
    heading: ".nr-faq-hero h1",
    body: ".nr-faq-hero__description",
    feature: ".nr-faq__content",
    featureMin: 700,
  },
  {
    route: "/contact",
    heading: ".nr-contact-intro h1",
    body: ".nr-contact-lead",
    feature: ".nr-contact-form-wrap",
    featureMin: 700,
  },
  {
    route: "/blog",
    heading: ".fa-blog-hero h1",
    body: ".fa-blog-hero .nr-shell > p:last-child",
    feature: ".fa-blog-hero .nr-shell",
    featureMin: 1200,
  },
  {
    route: "/confidentialitate",
    heading: ".legal-hero h1",
    body: ".legal-article p",
    feature: ".legal-layout",
    featureMin: 900,
  },
];

test("public pages remain substantial and readable on high-resolution viewports", async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 3840, height: 2160 });

  for (const probe of publicScaleProbes) {
    await page.goto(probe.route, { waitUntil: "domcontentloaded" });
    await expect(page.locator(probe.heading)).toBeVisible();
    await expect(page.locator(probe.body).first()).toBeAttached();

    const metrics = await page.evaluate(({ heading, body, feature }) => {
      const headingNode = document.querySelector(heading);
      const bodyNode = document.querySelector(body);
      const featureNode = document.querySelector(feature);
      if (!headingNode || !bodyNode || !featureNode) throw new Error("Missing public scale probe");
      return {
        heading: Number.parseFloat(getComputedStyle(headingNode).fontSize),
        body: Number.parseFloat(getComputedStyle(bodyNode).fontSize),
        featureWidth: featureNode.getBoundingClientRect().width,
        pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    }, probe);

    expect(metrics.heading, `${probe.route} heading`).toBeGreaterThanOrEqual(64);
    expect(metrics.body, `${probe.route} body copy`).toBeGreaterThanOrEqual(16);
    expect(metrics.featureWidth, `${probe.route} primary content`).toBeGreaterThanOrEqual(probe.featureMin);
    expect(metrics.featureWidth, `${probe.route} primary content maximum`).toBeLessThanOrEqual(1441);
    expect(metrics.pageOverflow, `${probe.route} horizontal overflow`).toBeLessThanOrEqual(1);
  }
});
