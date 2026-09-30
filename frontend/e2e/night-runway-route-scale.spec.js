const { expect, test } = require("@playwright/test");
const seed = require("../src/content/__fixtures__/siteContent.json");

const siteContent = {
  ...seed,
  contactPage: {
    ...seed.contactPage,
    showOptions: [
      ...seed.contactPage.showOptions,
      { id: "night-fireworks", label: "Artificii de noapte" },
    ],
  },
};

const article = {
  id: "responsive-article",
  slug: "titlu-lung",
  title: `Un titlu editorial ${"foartelungfaraspatii".repeat(12)}`,
  excerpt: "Un rezumat despre pregătirea unui spectacol.",
  body: "Primul paragraf al articolului.\n\nAl doilea paragraf al articolului.",
  category: "Culise",
  cover_media_id: "",
  cover_alt: "",
  status: "published",
  created_at: "2026-09-28T10:00:00Z",
  updated_at: "2026-09-28T10:00:00Z",
  published_at: "2026-09-28T10:00:00Z",
};

test.beforeEach(async ({ page }) => {
  await page.route("**/api/content", (route) => route.fulfill({
    json: { content: siteContent, revision_id: "route-scale", published_at: "2026-09-28T00:00:00Z" },
  }));
  await page.route("**/api/content/revision", (route) => route.fulfill({
    json: { revision_id: "route-scale", published_at: "2026-09-28T00:00:00Z" },
  }));
  await page.addInitScript(() => {
    window.localStorage.setItem("fireartro-cookie-consent-v1", JSON.stringify({
      necessary: true,
      analytics: false,
      marketing: false,
      savedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + (180 * 86_400_000)).toISOString(),
    }));
  });
  await page.route("**/api/blog/posts**", async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(pathname.endsWith(`/${article.slug}`) ? article : [article, {
        ...article, id: "responsive-article-2", slug: "al-doilea", title: "Al doilea articol",
      }]),
    });
  });
});

const wideRoutes = [
  { route: "/pachete", heading: ".nr-package-comparator h1", body: ".nr-package-stage__copy > span", feature: ".nr-package-stage__media", minWidth: 900, minHeight: 450 },
  { route: "/galerie", heading: ".nr-gallery-header h1", body: ".nr-gallery-header__intro", feature: ".nr-gallery-mosaic", minWidth: 1800, minHeight: 200 },
  { route: "/intrebari-frecvente", heading: ".nr-faq-hero h1", body: ".nr-faq-hero__description", feature: ".nr-faq__layout", minWidth: 1350, minHeight: 180, reading: ".nr-faq__content", maxReadingWidth: 1050 },
  { route: "/contact", heading: ".nr-contact-intro h1", body: ".nr-contact-lead", feature: ".nr-contact-form-wrap", minWidth: 900, minHeight: 200, composition: ".nr-contact-layout", minCompositionWidth: 1550 },
  { route: "/blog", heading: ".fa-blog-hero h1", body: ".fa-blog-hero .nr-shell > p:last-child", feature: ".fa-blog-grid", minWidth: 1800, minHeight: 200 },
  { route: "/confidentialitate", heading: ".legal-hero h1", body: ".legal-article > section p", feature: ".legal-layout", minWidth: 1350, minHeight: 200, reading: ".legal-article", maxReadingWidth: 1000 },
  { route: "/termeni-si-conditii", heading: ".legal-hero h1", body: ".legal-article > section p", feature: ".legal-layout", minWidth: 1350, minHeight: 200, reading: ".legal-article", maxReadingWidth: 1000 },
  { route: "/cookies", heading: ".legal-hero h1", body: ".legal-article > section p", feature: ".legal-layout", minWidth: 1350, minHeight: 200, reading: ".legal-article", maxReadingWidth: 1000 },
];

test("wide route introductions clear the enlarged fixed header", async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 2560, height: 1440 });
  for (const { route, selector } of [
    { route: "/pachete", selector: ".nr-package-comparator h1" },
    { route: "/galerie", selector: ".nr-gallery-header h1" },
    { route: "/intrebari-frecvente", selector: ".nr-faq-hero__eyebrow" },
    { route: "/contact", selector: ".nr-contact-kicker" },
    { route: "/blog", selector: ".fa-blog-hero .fa-kicker" },
    { route: "/termeni-si-conditii", selector: ".legal-hero-inner > span" },
  ]) {
    await page.goto(route, { waitUntil: "domcontentloaded" });
    await expect(page.locator(selector)).toBeVisible();
    const clearance = await page.evaluate((target) => (
      document.querySelector(target).getBoundingClientRect().top
      - document.querySelector(".site-navbar").getBoundingClientRect().bottom
    ), selector);
    expect(clearance, `${route} introduction clears fixed navigation`).toBeGreaterThanOrEqual(24);
  }
});

for (const probe of wideRoutes) {
  test(`${probe.route} uses the wide route composition with readable copy at 2560`, async ({ page }) => {
    test.setTimeout(60_000);
    await page.setViewportSize({ width: 2560, height: 1440 });
    await page.goto(probe.route, { waitUntil: "domcontentloaded" });
    await expect(page.locator(probe.heading)).toBeVisible();
    await expect(page.locator(probe.body).first()).toBeVisible();
    await expect(page.locator(probe.feature)).toBeVisible();

    const metrics = await page.evaluate(({ heading, body, feature, reading, composition }) => {
      const rect = (selector) => document.querySelector(selector).getBoundingClientRect();
      const text = (selector) => Number.parseFloat(getComputedStyle(document.querySelector(selector)).fontSize);
      const headingRect = rect(heading);
      const bodyRect = rect(body);
      const featureRect = rect(feature);
      return {
        headingSize: text(heading), bodySize: text(body),
        headingRect: { left: headingRect.left, right: headingRect.right },
        bodyRect: { left: bodyRect.left, right: bodyRect.right },
        featureRect: { left: featureRect.left, right: featureRect.right, width: featureRect.width, height: featureRect.height },
        readingWidth: reading ? rect(reading).width : null,
        compositionWidth: composition ? rect(composition).width : null,
        rootSize: Number.parseFloat(getComputedStyle(document.documentElement).fontSize),
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        viewportWidth: document.documentElement.clientWidth,
      };
    }, probe);

    expect(metrics.headingSize, "page title").toBeGreaterThanOrEqual(64);
    expect(metrics.bodySize, "body copy").toBeGreaterThanOrEqual(18);
    expect(metrics.featureRect.width, "primary block width").toBeGreaterThanOrEqual(probe.minWidth);
    expect(metrics.featureRect.width, "primary block cap").toBeLessThanOrEqual((90 * metrics.rootSize) + 1);
    expect(metrics.featureRect.height, "primary block height").toBeGreaterThanOrEqual(probe.minHeight);
    if (probe.reading) expect(metrics.readingWidth, "reading column cap").toBeLessThanOrEqual(probe.maxReadingWidth * (metrics.rootSize / 16));
    if (probe.composition) expect(metrics.compositionWidth, "surrounding composition").toBeGreaterThanOrEqual(probe.minCompositionWidth);
    for (const key of ["headingRect", "bodyRect", "featureRect"]) {
      expect(metrics[key].left, `${key} left edge`).toBeGreaterThanOrEqual(-1);
      expect(metrics[key].right, `${key} right edge`).toBeLessThanOrEqual(metrics.viewportWidth + 1);
    }
    expect(metrics.overflow, "document horizontal overflow").toBeLessThanOrEqual(1);
  });
}

for (const control of [
  { route: "/pachete", selector: ".nr-package-categories button", minimum: 22 },
  { route: "/galerie", selector: ".nr-gallery-filters button", minimum: 22 },
  { route: "/intrebari-frecvente", selector: ".nr-faq__trigger", minimum: 25 },
  { route: "/contact", selector: ".nr-contact-field input", minimum: 23 },
  { route: "/confidentialitate", selector: ".legal-nav a", minimum: 19 },
]) {
  test(`${control.route} keeps its main controls readable at 2560`, async ({ page }) => {
    await page.setViewportSize({ width: 2560, height: 1440 });
    await page.goto(control.route, { waitUntil: "domcontentloaded" });
    await expect(page.locator(control.selector).first()).toBeVisible();
    const size = await page.locator(control.selector).first().evaluate((node) => Number.parseFloat(getComputedStyle(node).fontSize));
    expect(size).toBeGreaterThanOrEqual(control.minimum);
  });
}

test("long CMS Blog titles wrap inside archive cards and the article reading column", async ({ page }) => {
  await page.setViewportSize({ width: 2560, height: 1440 });
  await page.goto("/blog", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".fa-blog-card h3").first()).toContainText("foartelungfaraspatii");
  const card = await page.locator(".fa-blog-card h3").first().evaluate((node) => ({
    client: node.clientWidth, scroll: node.scrollWidth,
    titleRight: node.getBoundingClientRect().right,
    cardRight: node.closest(".fa-blog-card").getBoundingClientRect().right,
  }));
  expect(card.scroll, "archive title clipping").toBeLessThanOrEqual(card.client + 1);
  expect(card.titleRight, "archive title stays inside its card").toBeLessThanOrEqual(card.cardRight + 1);

  await page.goto(`/blog/${article.slug}`, { waitUntil: "domcontentloaded" });
  await expect(page.locator(".fa-blog-article h1")).toContainText("foartelungfaraspatii");
  const reading = await page.locator(".fa-blog-article").evaluate((node) => ({
    width: node.getBoundingClientRect().width,
    headingClient: node.querySelector("h1").clientWidth,
    headingScroll: node.querySelector("h1").scrollWidth,
    rootSize: Number.parseFloat(getComputedStyle(document.documentElement).fontSize),
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  }));
  expect(reading.width, "article reading column").toBeLessThanOrEqual(900 * (reading.rootSize / 16));
  expect(reading.headingScroll, "article heading clipping").toBeLessThanOrEqual(reading.headingClient + 1);
  expect(reading.overflow, "article page overflow").toBeLessThanOrEqual(1);
});

test("package video playlist labels remain legible at 2560", async ({ page }) => {
  await page.setViewportSize({ width: 2560, height: 1440 });
  await page.goto("/pachete", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".nr-video-playlist__label").first()).toBeVisible();
  const sizes = await page.locator(".nr-video-playlist").evaluate((node) => ({
    heading: Number.parseFloat(getComputedStyle(node.querySelector("header > span")).fontSize),
    hint: Number.parseFloat(getComputedStyle(node.querySelector("header small")).fontSize),
    label: Number.parseFloat(getComputedStyle(node.querySelector(".nr-video-playlist__label")).fontSize),
  }));
  expect(sizes.heading).toBeGreaterThanOrEqual(18);
  expect(sizes.hint).toBeGreaterThanOrEqual(16);
  expect(sizes.label).toBeGreaterThanOrEqual(16);
});

test("route descriptions remain readable without horizontal overflow at 375", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  for (const probe of wideRoutes) {
    await page.goto(probe.route, { waitUntil: "domcontentloaded" });
    await expect(page.locator(probe.body).first()).toBeVisible();
    const metrics = await page.locator(probe.body).first().evaluate((node) => ({
      size: Number.parseFloat(getComputedStyle(node).fontSize),
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      left: node.getBoundingClientRect().left,
      right: node.getBoundingClientRect().right,
    }));
    expect(metrics.size, `${probe.route} description size`).toBeGreaterThanOrEqual(16);
    expect(metrics.left, `${probe.route} description left`).toBeGreaterThanOrEqual(-1);
    expect(metrics.right, `${probe.route} description right`).toBeLessThanOrEqual(376);
    expect(metrics.overflow, `${probe.route} document overflow`).toBeLessThanOrEqual(1);
  }
});

test("375px contact date, select and optional fields have their own row", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto("/contact", { waitUntil: "domcontentloaded" });
  await expect(page.getByLabel("Data evenimentului")).toBeVisible();
  await page.getByText("Adaugă detalii", { exact: true }).click();

  const groups = await page.locator(".nr-contact-fields, .nr-contact-optional__fields").evaluateAll((nodes) => nodes.map((group) => {
    const fields = [...group.querySelectorAll(":scope > .nr-contact-field")];
    return {
      groupWidth: group.getBoundingClientRect().width,
      columns: getComputedStyle(group).gridTemplateColumns.split(" ").length,
      fields: fields.map((field) => ({
        left: field.getBoundingClientRect().left,
        width: field.getBoundingClientRect().width,
        top: field.getBoundingClientRect().top,
      })),
    };
  }));
  expect(groups).toHaveLength(3);
  for (const group of groups) {
    expect(group.columns, "one field per row").toBe(1);
    for (const field of group.fields) expect(field.width, "field uses available width").toBeGreaterThanOrEqual(group.groupWidth - 1);
    for (let index = 1; index < group.fields.length; index += 1) {
      expect(group.fields[index].top, "fields do not share a row").toBeGreaterThan(group.fields[index - 1].top);
    }
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
});

test("short landscape package and gallery categories leave the content reachable", async ({ page }) => {
  await page.setViewportSize({ width: 667, height: 375 });
  for (const item of [
    { route: "/pachete", filters: ".nr-package-categories", next: ".nr-package-variant-strip", media: ".nr-package-stage__media" },
    { route: "/galerie", filters: ".nr-gallery-filters", media: ".nr-gallery-card" },
  ]) {
    await page.goto(item.route, { waitUntil: "domcontentloaded" });
    await expect(page.locator(item.filters)).toBeVisible();
    await expect(page.locator(item.media).first()).toBeVisible();
    const metrics = await page.evaluate(({ filters, next, media }) => ({
      filtersHeight: document.querySelector(filters).getBoundingClientRect().height,
      nextHeight: next ? document.querySelector(next).getBoundingClientRect().height : null,
      mediaTop: document.querySelector(media).getBoundingClientRect().top,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    }), item);
    expect(metrics.filtersHeight, `${item.route} categories`).toBeLessThanOrEqual(150);
    if (item.next) expect(metrics.nextHeight, "package variants").toBeLessThanOrEqual(100);
    expect(metrics.mediaTop, `${item.route} first media`).toBeLessThanOrEqual(750);
    expect(metrics.overflow, `${item.route} horizontal overflow`).toBeLessThanOrEqual(1);
  }
});

test("short landscape package and gallery descriptions stay readable", async ({ page }) => {
  for (const viewport of [{ width: 667, height: 375 }, { width: 844, height: 390 }]) {
    await page.setViewportSize(viewport);
    for (const probe of [
      { route: "/pachete", selectors: [".nr-package-comparator__header > p", ".nr-package-stage__copy > span"] },
      { route: "/galerie", selectors: [".nr-gallery-header__intro"] },
    ]) {
      await page.goto(probe.route, { waitUntil: "domcontentloaded" });
      for (const selector of probe.selectors) {
        const copy = page.locator(selector).first();
        await expect(copy).toBeVisible();
        const size = await copy.evaluate((node) => Number.parseFloat(getComputedStyle(node).fontSize));
        expect(size, `${probe.route} ${selector} at ${viewport.width}`).toBeGreaterThanOrEqual(16);
      }
    }
  }
});

test("package selection reaches Contact with the chosen service and package", async ({ page }) => {
  await page.setViewportSize({ width: 2560, height: 1440 });
  await page.goto("/pachete", { waitUntil: "domcontentloaded" });
  await Promise.all([
    page.waitForURL("**/contact"),
    page.getByTestId("packages-direct-cta").click(),
  ]);
  await expect(page.getByLabel("Spectacol dorit")).toHaveValue("Artificii de noapte");
  await page.getByText("Adaugă detalii", { exact: true }).click();
  await expect(page.getByLabel("Pachet selectat")).toHaveValue("night-gold");
});

test("Gallery filters and lightbox preserve URL state at 2560", async ({ page }) => {
  await page.setViewportSize({ width: 2560, height: 1440 });
  await page.goto("/galerie", { waitUntil: "domcontentloaded" });
  await page.getByRole("tablist", { name: "Filtre galerie" }).getByRole("tab", { name: /Spectacole de drone/ }).click();
  await expect(page).toHaveURL(/filtru=Drone/);
  await page.getByTestId("gallery-card").first().locator("button").click();
  await expect(page.locator(".nr-gallery-lightbox[role='dialog']")).toBeVisible();
  await expect(page).toHaveURL(/media=/);
  await page.keyboard.press("Escape");
  await expect(page).not.toHaveURL(/media=/);
});

test("FAQ accordion still opens and closes at 2560", async ({ page }) => {
  await page.setViewportSize({ width: 2560, height: 1440 });
  await page.goto("/intrebari-frecvente", { waitUntil: "domcontentloaded" });
  const question = page.getByTestId("faq-question").first();
  const trigger = question.getByRole("button");
  await trigger.click();
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
  await trigger.click();
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
});

test("Blog archive opens an article and returns to the archive", async ({ page }) => {
  await page.setViewportSize({ width: 2560, height: 1440 });
  await page.goto("/blog", { waitUntil: "domcontentloaded" });
  await page.locator(".fa-blog-card h3 a").first().click();
  await expect(page).toHaveURL(/\/blog\/titlu-lung$/);
  await expect(page.locator(".fa-blog-article h1")).toContainText("Un titlu editorial");
  await page.getByRole("link", { name: "Înapoi la Blog" }).click();
  await expect(page).toHaveURL(/\/blog$/);
});

test("Contact validation identifies the first incomplete field on a phone", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto("/contact", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Trimite cererea" }).click();
  await expect(page.getByRole("alert")).toContainText("Completează câmpurile obligatorii");
  await expect(page.getByLabel("Tip eveniment")).toBeFocused();
});
