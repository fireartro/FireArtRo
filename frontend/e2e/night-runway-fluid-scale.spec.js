const { expect, test } = require("@playwright/test");
const seed = require("../src/content/__fixtures__/siteContent.json");
const content = {
  ...seed,
  navigation: {
    links: [
      { id: "about", label: "Despre noi", href: "#intro" },
      { id: "packages", label: "Pachete", href: "/pachete" },
      { id: "gallery", label: "Galerie", href: "/galerie" },
      { id: "faq", label: "Întrebări", href: "/intrebari-frecvente" },
      { id: "blog", label: "Blog", href: "/blog" },
      { id: "contact", label: "Contact", href: "/contact" },
    ],
  },
};

test.beforeEach(async ({ page }) => {
  await page.route("**/api/content", (route) => route.fulfill({
    json: { content, revision_id: "responsive-layout-qa", published_at: "2026-09-28T00:00:00Z" },
  }));
  await page.route("**/api/content/revision", (route) => route.fulfill({
    json: { revision_id: "responsive-layout-qa", published_at: "2026-09-28T00:00:00Z" },
  }));
});

const scaleCases = [
  { width: 1512, height: 982, navMin: 12, bodyMin: 14, labelMin: 11, actionMin: 11, partnerMin: 11, partnerTitleMin: 0, footerLinkMin: 11, heroTitleMin: 72, galleryTitleMin: 52, shellMin: 1300 },
  { width: 2560, height: 1440, navMin: 25, bodyMin: 25, labelMin: 18, actionMin: 19, partnerMin: 19, partnerTitleMin: 80, footerLinkMin: 18, heroTitleMin: 150, galleryTitleMin: 88, shellMin: 1800 },
  { width: 3840, height: 2160, navMin: 30, bodyMin: 29, labelMin: 22, actionMin: 22, partnerMin: 23, partnerTitleMin: 100, footerLinkMin: 21, heroTitleMin: 185, galleryTitleMin: 128, shellMin: 2100 },
  { width: 5120, height: 1440, navMin: 30, bodyMin: 29, labelMin: 22, actionMin: 22, partnerMin: 23, partnerTitleMin: 100, footerLinkMin: 21, heroTitleMin: 185, galleryTitleMin: 128, shellMin: 2100 },
];

test("large viewports retain deliberate visual scale without stretching readable content", async ({ page }) => {
  await page.goto("/#acasa", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".fa-footer__frame.nr-shell")).toBeAttached();

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
      const shell = document.querySelector(".fa-footer__frame.nr-shell");
      if (!shell) throw new Error("Missing representative layout shell");

      return {
        nav: number(".site-navbar-links > a"),
        body: Number.parseFloat(getComputedStyle(document.body).fontSize),
        label: number(".fa-footer__column > p"),
        action: number("#acasa .nr-hero__actions .nr-button"),
        partner: number(".fa-partner__name"),
        partnerTitle: number(".fa-partner-marquee__copy h2"),
        footerLink: number(".fa-footer__column a"),
        heroTitle: number(".nr-hero__title"),
        galleryTitle: number(".fa-work__intro h2"),
        shellWidth: shell.getBoundingClientRect().width,
        rootSize: Number.parseFloat(getComputedStyle(document.documentElement).fontSize),
        viewportWidth: window.innerWidth,
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    });

    const label = `${viewport.width}x${viewport.height}`;
    expect(metrics.nav, `${label} navigation`).toBeGreaterThanOrEqual(viewport.navMin);
    expect(metrics.body, `${label} body`).toBeGreaterThanOrEqual(viewport.bodyMin);
    expect(metrics.label, `${label} label`).toBeGreaterThanOrEqual(viewport.labelMin);
    expect(metrics.action, `${label} hero action`).toBeGreaterThanOrEqual(viewport.actionMin);
    expect(metrics.partner, `${label} partner name`).toBeGreaterThanOrEqual(viewport.partnerMin);
    expect(metrics.partnerTitle, `${label} partner headline`).toBeGreaterThanOrEqual(viewport.partnerTitleMin);
    expect(metrics.footerLink, `${label} footer link`).toBeGreaterThanOrEqual(viewport.footerLinkMin);
    expect(metrics.heroTitle, `${label} hero title`).toBeGreaterThanOrEqual(viewport.heroTitleMin);
    expect(metrics.galleryTitle, `${label} gallery title`).toBeGreaterThanOrEqual(viewport.galleryTitleMin);
    expect(metrics.shellWidth, `${label} layout shell minimum`).toBeGreaterThanOrEqual(viewport.shellMin);
    const layoutMax = Math.min(138 * metrics.rootSize, Math.max(90 * metrics.rootSize, viewport.width * 0.75));
    expect(metrics.shellWidth, `${label} visual layout maximum`).toBeLessThanOrEqual(layoutMax + 1);
    expect(metrics.overflow, `${label} horizontal overflow`).toBeLessThanOrEqual(1);
  }
});

test("phone body copy keeps a 16px floor", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/#acasa", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".fa-footer__frame")).toBeAttached();

  const metrics = await page.evaluate(() => {
    const viewportWidth = document.documentElement.clientWidth;
    const bounds = [".site-navbar-logo", ".nr-hero__title", ".nr-hero__actions", ".fa-footer__frame"]
      .map((selector) => {
        const element = document.querySelector(selector);
        if (!element) throw new Error(`Missing phone bounds probe: ${selector}`);
        const rect = element.getBoundingClientRect();
        return { selector, left: rect.left, right: rect.right };
      });
    return {
      bodySize: Number.parseFloat(getComputedStyle(document.body).fontSize),
      viewportWidth,
      bounds,
    };
  });
  expect(metrics.bodySize).toBeGreaterThanOrEqual(16);
  for (const bound of metrics.bounds) {
    expect(bound.left, `${bound.selector} left edge`).toBeGreaterThanOrEqual(-1);
    expect(bound.right, `${bound.selector} right edge`).toBeLessThanOrEqual(metrics.viewportWidth + 1);
  }
});

test("short landscape keeps body copy readable and the display title within the viewport", async ({ page }) => {
  await page.setViewportSize({ width: 2560, height: 720 });
  await page.goto("/#acasa", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".nr-hero__title")).toBeAttached();
  await expect(page.getByTestId("hero-primary-cta")).toBeVisible();
  await expect(page.getByTestId("hero-secondary-cta")).toBeVisible();

  const metrics = await page.evaluate(() => {
    const title = document.querySelector(".nr-hero__title");
    const navbar = document.querySelector(".site-navbar");
    if (!title || !navbar) throw new Error("Missing short-landscape scale probe");
    return {
      body: Number.parseFloat(getComputedStyle(document.body).fontSize),
      title: title.getBoundingClientRect().toJSON(),
      navbarBottom: navbar.getBoundingClientRect().bottom,
      actions: [...document.querySelectorAll(".nr-hero__actions .nr-button")]
        .map((button) => button.getBoundingClientRect().toJSON()),
      availableHeight: window.innerHeight - navbar.getBoundingClientRect().height,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });

  expect(metrics.body, "2560x720 body copy").toBeGreaterThanOrEqual(18);
  expect(metrics.title.height, "2560x720 display title height").toBeLessThanOrEqual(metrics.availableHeight);
  expect(metrics.title.top, "2560x720 title clears navigation").toBeGreaterThanOrEqual(metrics.navbarBottom - 1);
  expect(metrics.title.bottom, "2560x720 title visible below fold").toBeLessThanOrEqual(721);
  expect(metrics.actions).toHaveLength(2);
  for (const action of metrics.actions) {
    expect(action.height, "2560x720 hero action has visible height").toBeGreaterThanOrEqual(44);
    expect(action.bottom, "2560x720 hero action visible below fold").toBeLessThanOrEqual(721);
  }
  expect(metrics.overflow, "2560x720 horizontal overflow").toBeLessThanOrEqual(1);
});

test("wide navigation and footer use the visual width without stretching legal copy", async ({ page }) => {
  await page.setViewportSize({ width: 3840, height: 2160 });
  await page.goto("/#acasa", { waitUntil: "domcontentloaded" });
  await page.locator(".fa-footer__pnrr img").scrollIntoViewIfNeeded();
  await expect(page.locator(".fa-footer__pnrr img")).toBeVisible();

  const metrics = await page.evaluate(() => {
    const logo = document.querySelector(".site-navbar-logo");
    const leftLink = document.querySelector(".site-navbar-links-left > a:last-child");
    const rightLink = document.querySelector(".site-navbar-links-right > a:first-child");
    const pnrr = document.querySelector(".fa-footer__pnrr img");
    const legalCopy = document.querySelector(".fa-footer__identity p");
    if (!logo || !leftLink || !rightLink || !pnrr || !legalCopy) throw new Error("Missing wide chrome probe");
    const logoBounds = logo.getBoundingClientRect();
    return {
      logoCenter: (logoBounds.left + logoBounds.right) / 2,
      viewportCenter: document.documentElement.clientWidth / 2,
      leftGap: logoBounds.left - leftLink.getBoundingClientRect().right,
      rightGap: rightLink.getBoundingClientRect().left - logoBounds.right,
      pnrrWidth: pnrr.getBoundingClientRect().width,
      legalWidth: legalCopy.getBoundingClientRect().width,
      rootSize: Number.parseFloat(getComputedStyle(document.documentElement).fontSize),
    };
  });

  expect(Math.abs(metrics.logoCenter - metrics.viewportCenter), "centered navbar logo").toBeLessThanOrEqual(8);
  expect(metrics.leftGap / metrics.rootSize, "left links clear the logo").toBeGreaterThanOrEqual(1);
  expect(metrics.leftGap / metrics.rootSize, "left links keep the compact logo rhythm").toBeLessThanOrEqual(1.5);
  expect(metrics.rightGap / metrics.rootSize, "right links clear the logo").toBeGreaterThanOrEqual(1);
  expect(metrics.rightGap / metrics.rootSize, "right links keep the compact logo rhythm").toBeLessThanOrEqual(1.5);
  expect(metrics.pnrrWidth, "PNRR artwork uses the wide footer").toBeGreaterThanOrEqual(900);
  expect(metrics.legalWidth, "legal copy remains a reading column").toBeLessThanOrEqual(900 * (metrics.rootSize / 16));
});

test("wide navigation keeps the same compact link rhythm as 1440", async ({ page }) => {
  await page.goto("/#acasa", { waitUntil: "domcontentloaded" });

  for (const viewport of [{ width: 2560, height: 1440 }, { width: 3840, height: 2160 }]) {
    await page.setViewportSize(viewport);
    await expect(page.locator(".site-navbar-links-left > a")).toHaveCount(3);

    const metrics = await page.evaluate(() => {
      const rect = (node) => node.getBoundingClientRect();
      const groups = [".site-navbar-links-left", ".site-navbar-links-right"]
        .map((selector) => [...document.querySelectorAll(`${selector} > a`)].map(rect));
      const logo = rect(document.querySelector(".site-navbar-logo"));
      return {
        rootSize: Number.parseFloat(getComputedStyle(document.documentElement).fontSize),
        linkGaps: groups.flatMap((links) => links.slice(1).map((link, index) => link.left - links[index].right)),
        logoGaps: [logo.left - groups[0].at(-1).right, groups[1][0].left - logo.right],
      };
    });

    for (const gap of metrics.linkGaps) {
      expect(gap / metrics.rootSize, `${viewport.width}px link gap`).toBeLessThanOrEqual(0.5);
    }
    for (const gap of metrics.logoGaps) {
      expect(gap / metrics.rootSize, `${viewport.width}px logo gap`).toBeGreaterThanOrEqual(0.5);
      expect(gap / metrics.rootSize, `${viewport.width}px logo gap`).toBeLessThanOrEqual(2);
    }
  }
});

test("high-resolution header and social dock remain visually prominent", async ({ page }) => {
  await page.goto("/#acasa", { waitUntil: "domcontentloaded" });

  for (const viewport of [{ width: 2560, height: 1440 }, { width: 3840, height: 2160 }]) {
    await page.setViewportSize(viewport);
    await expect(page.locator(".desktop-social-dock .social-dock-icon").first()).toBeVisible();

    const metrics = await page.evaluate(() => {
      const size = (selector) => document.querySelector(selector).getBoundingClientRect();
      return {
        rootSize: Number.parseFloat(getComputedStyle(document.documentElement).fontSize),
        navFont: Number.parseFloat(getComputedStyle(document.querySelector(".site-navbar-links > a")).fontSize),
        logoHeight: size(".site-navbar-brand img").height,
        iconWidth: size(".desktop-social-dock .social-dock-icon").width,
        dockLinkWidth: size(".desktop-social-dock .social-dock-link").width,
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    });

    expect(metrics.navFont / metrics.rootSize, `${viewport.width}px navigation text`).toBeGreaterThanOrEqual(1.4);
    expect(metrics.logoHeight / metrics.rootSize, `${viewport.width}px header logo`).toBeGreaterThanOrEqual(4.3);
    expect(metrics.iconWidth / metrics.rootSize, `${viewport.width}px social icons`).toBeGreaterThanOrEqual(1.7);
    expect(metrics.dockLinkWidth / metrics.rootSize, `${viewport.width}px social hit area`).toBeGreaterThanOrEqual(2.99);
    expect(metrics.overflow, `${viewport.width}px horizontal overflow`).toBeLessThanOrEqual(1);
  }
});

test("wide cookie consent has readable choices and stays within the viewport", async ({ page }) => {
  await page.setViewportSize({ width: 2560, height: 1440 });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const consent = page.getByTestId("cookie-consent");
  await expect(consent).toBeVisible();
  const metrics = await consent.evaluate((node) => {
    const panel = node.querySelector(".cookie-consent-panel");
    const rect = panel.getBoundingClientRect();
    const size = (selector) => Number.parseFloat(getComputedStyle(panel.querySelector(selector)).fontSize);
    return {
      left: rect.left,
      right: rect.right,
      width: rect.width,
      title: size("h2"),
      summary: size("header p"),
      choice: size(".cookie-consent-actions button"),
    };
  });
  expect(metrics.width).toBeGreaterThanOrEqual(1000);
  expect(metrics.left).toBeGreaterThanOrEqual(0);
  expect(metrics.right).toBeLessThanOrEqual(2560);
  expect(metrics.title).toBeGreaterThanOrEqual(20);
  expect(metrics.summary).toBeGreaterThanOrEqual(16);
  expect(metrics.choice).toBeGreaterThanOrEqual(16);
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
        rootSize: Number.parseFloat(getComputedStyle(document.documentElement).fontSize),
        pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    }, probe);

    expect(metrics.heading, `${probe.route} heading`).toBeGreaterThanOrEqual(64);
    expect(metrics.body, `${probe.route} body copy`).toBeGreaterThanOrEqual(16);
    expect(metrics.featureWidth, `${probe.route} primary content`).toBeGreaterThanOrEqual(probe.featureMin);
    expect(metrics.featureWidth, `${probe.route} primary content maximum`).toBeLessThanOrEqual((90 * metrics.rootSize) + 1);
    expect(metrics.pageOverflow, `${probe.route} horizontal overflow`).toBeLessThanOrEqual(1);
  }
});
