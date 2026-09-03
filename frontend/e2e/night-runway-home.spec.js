const { test, expect } = require("@playwright/test");

const responsiveViewports = [
  { width: 1440, height: 900 },
  { width: 430, height: 932 },
  { width: 844, height: 390 },
];

test.describe("FireArt scroll canvas landing", () => {
  test("plays the cinematic hero video on desktop", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/", { waitUntil: "domcontentloaded" });

    const hero = page.getByTestId("hero-section");
    await expect(hero).toBeVisible();
    const heroVideo = hero.locator("video");
    await expect(heroVideo).toHaveCount(1);
    await expect.poll(() => heroVideo.evaluate((node) => node.currentSrc)).toMatch(/fireart-hero-wide\.mp4/);
    await expect(page.getByTestId("hero-primary-cta")).toHaveAttribute("href", /contact/);
    await expect(page.getByTestId("hero-secondary-cta")).toHaveAttribute("href", "/galerie");
  });

  test("preserves the existing hero before the redesigned story", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/", { waitUntil: "domcontentloaded" });

    const hero = page.getByTestId("hero-section");
    await expect(hero).toBeVisible();
    await expect(hero.locator("video")).toHaveCount(1);
    await expect.poll(() => hero.locator("video").evaluate((node) => node.currentSrc)).toMatch(/fireart-hero-wide\.mp4/);
    await expect(page.getByTestId("hero-primary-cta")).toHaveAttribute("href", /contact/);
    await expect(page.getByTestId("hero-secondary-cta")).toHaveAttribute("href", "/galerie");
  });

  test("types left to right, deletes right to left, and keeps the hero geometry stable", async ({ page }) => {
    await page.setViewportSize({ width: 868, height: 698 });
    await page.clock.install({ time: new Date("2026-08-01T12:00:00.000Z") });
    await page.clock.pauseAt(new Date("2026-08-01T12:00:00.100Z"));
    await page.goto("/", { waitUntil: "domcontentloaded" });

    const title = page.getByRole("heading", { level: 1, name: "Spectacole în lumină." });
    const keyword = page.locator(".nr-hero__keyword");
    const primary = page.getByTestId("hero-primary-cta");

    await expect(title).toBeVisible();
    await expect(keyword).toHaveText("");

    await page.clock.runFor(450);
    await expect(keyword).toHaveText("l");
    await page.clock.runFor(85);
    await expect(keyword).toHaveText("lu");
    for (const expectedWord of ["lum", "lumi", "lumin", "lumină", "lumină."]) {
      await page.clock.runFor(85);
      await expect(keyword).toHaveText(expectedWord);
    }

    const firstTitleBox = await title.boundingBox();
    const firstCtaBox = await primary.boundingBox();

    await page.clock.runFor(3200);
    await expect(keyword).toHaveAttribute("data-phase", "deleting");
    await page.clock.runFor(55);
    await expect(keyword).toHaveText("lumină");
    await page.clock.runFor(55);
    await expect(keyword).toHaveText("lumin");

    for (const expectedWord of ["lumi", "lum", "lu", "l", ""]) {
      await page.clock.runFor(55);
      await expect(keyword).toHaveText(expectedWord);
    }
    await page.clock.runFor(180);
    await expect(keyword).toHaveText("");
    await page.clock.runFor(85);
    await expect(keyword).toHaveText("m");
    for (const expectedWord of ["mi", "miș", "mișc", "mișca", "mișcar", "mișcare", "mișcare."]) {
      await page.clock.runFor(85);
      await expect(keyword).toHaveText(expectedWord);
    }

    const secondTitleBox = await title.boundingBox();
    const secondCtaBox = await primary.boundingBox();

    expect(Math.abs((firstTitleBox?.height || 0) - (secondTitleBox?.height || 0))).toBeLessThanOrEqual(1);
    expect(Math.abs((firstCtaBox?.y || 0) - (secondCtaBox?.y || 0))).toBeLessThanOrEqual(1);
  });

  test("renders a static accessible hero title when reduced motion is requested", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/", { waitUntil: "domcontentloaded" });

    await expect(page.getByRole("heading", { level: 1, name: "Spectacole în lumină." })).toBeVisible();
    await expect(page.locator(".nr-hero__keyword")).toHaveText("lumină.");
    await expect(page.locator(".nr-hero__caret")).toHaveCount(0);
    await page.waitForTimeout(1200);
    await expect(page.locator(".nr-hero__keyword")).toHaveText("lumină.");
  });

  test("uses a centered editorial hero composition without framed actions", async ({ page }) => {
    await page.setViewportSize({ width: 868, height: 698 });
    await page.goto("/", { waitUntil: "domcontentloaded" });

    const eyebrow = page.locator(".nr-hero__eyebrow");
    const primary = page.getByTestId("hero-primary-cta");
    const secondary = page.getByTestId("hero-secondary-cta");
    const socialLinks = page.getByTestId("social-dock").locator(".social-dock-link");

    const eyebrowBox = await eyebrow.boundingBox();
    const [primaryBox, secondaryBox] = await page
      .locator('[data-testid="hero-primary-cta"], [data-testid="hero-secondary-cta"]')
      .evaluateAll((nodes) => nodes.map((node) => {
        const rect = node.getBoundingClientRect();
        return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
      }));

    expect(eyebrowBox?.y).toBeGreaterThanOrEqual(125);
    expect(Math.abs((primaryBox?.y || 0) - (secondaryBox?.y || 0))).toBeLessThan(2);
    await expect(primary).toHaveCSS("border-top-width", "0px");
    await expect(primary).toHaveCSS("clip-path", "none");
    await expect(secondary).toHaveCSS("border-top-width", "0px");
    await expect(socialLinks.first()).toHaveCSS("border-top-width", "0px");
    await expect(socialLinks.first()).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  });

  test("keeps the hero video full bleed across the complete stage", async ({ page }) => {
    await page.setViewportSize({ width: 1914, height: 905 });
    await page.goto("/", { waitUntil: "domcontentloaded" });

    const heroBox = await page.getByTestId("hero-section").boundingBox();
    const stageBox = await page.locator(".hero-video-stage").boundingBox();
    const heroMediaBox = await page.locator(".hero-media-video").boundingBox();

    expect(stageBox?.x).toBeLessThanOrEqual((heroBox?.x || 0) + 1);
    expect(stageBox?.y).toBeLessThanOrEqual((heroBox?.y || 0) + 1);
    expect((stageBox?.x || 0) + (stageBox?.width || 0)).toBeGreaterThanOrEqual((heroBox?.x || 0) + (heroBox?.width || 0) - 1);
    expect((stageBox?.y || 0) + (stageBox?.height || 0)).toBeGreaterThanOrEqual((heroBox?.y || 0) + (heroBox?.height || 0) - 1);
    expect(heroMediaBox?.x).toBeLessThanOrEqual((heroBox?.x || 0) + 1);
    expect((heroMediaBox?.x || 0) + (heroMediaBox?.width || 0)).toBeGreaterThanOrEqual((heroBox?.x || 0) + (heroBox?.width || 0) - 1);
    await expect(page.locator(".hero-media-video")).toHaveCSS("object-fit", "cover");
  });

  test("keeps the desktop title in its left safe zone without moving the mobile gutter", async ({ page }) => {
    await page.setViewportSize({ width: 1914, height: 905 });
    await page.goto("/", { waitUntil: "domcontentloaded" });

    const desktopTitle = page.locator(".nr-hero__title");
    const desktopTitleBox = await desktopTitle.boundingBox();
    const desktopFontSize = Number.parseFloat(await desktopTitle.evaluate((node) => getComputedStyle(node).fontSize));

    expect(desktopTitleBox?.x).toBeGreaterThanOrEqual(1914 * 0.04);
    expect(desktopTitleBox?.x).toBeLessThanOrEqual(1914 * 0.12);
    expect(desktopFontSize).toBeGreaterThanOrEqual(96);

    await page.setViewportSize({ width: 430, height: 932 });
    await page.reload({ waitUntil: "domcontentloaded" });
    const mobileTitleBox = await page.locator(".nr-hero__title").boundingBox();

    expect(mobileTitleBox?.x).toBeLessThanOrEqual(24);
  });

  test("scales the desktop navigation and social controls without adding frames", async ({ page }) => {
    await page.setViewportSize({ width: 1157, height: 930 });
    await page.goto("/", { waitUntil: "domcontentloaded" });

    const navLink = page.locator(".site-navbar-links > a").first();
    const logo = page.locator(".site-navbar-brand img").first();
    const socialLink = page.getByTestId("social-dock").locator(".social-dock-link").first();
    const socialIcon = socialLink.locator(".social-dock-icon");
    const navFontSize = Number.parseFloat(await navLink.evaluate((node) => getComputedStyle(node).fontSize));
    const logoBox = await logo.boundingBox();
    const socialLinkBox = await socialLink.boundingBox();
    const socialIconBox = await socialIcon.boundingBox();

    expect(navFontSize).toBeGreaterThanOrEqual(12);
    expect(logoBox?.height).toBeGreaterThanOrEqual(36);
    expect(socialLinkBox?.width).toBeGreaterThanOrEqual(48);
    expect(socialIconBox?.width).toBeGreaterThanOrEqual(18);
    await expect(socialLink).toHaveCSS("border-top-width", "0px");
    await expect(socialLink).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  });

  test("balances three desktop navigation links on each side of the home logo", async ({ page }) => {
    await page.setViewportSize({ width: 1157, height: 930 });
    await page.goto("/", { waitUntil: "domcontentloaded" });

    const navbar = page.getByTestId("main-navbar");
    await expect(navbar.locator(".site-navbar-links-left > a")).toHaveCount(3);
    await expect(navbar.locator(".site-navbar-links-right > a")).toHaveCount(3);
    await expect(navbar.getByTestId("nav-link-acasa")).toHaveCount(0);
    await expect(navbar.getByTestId("nav-logo")).toHaveAttribute("href", "/#acasa");
    await expect(navbar.locator(".site-navbar-links-left > a")).toHaveText(["Despre noi", "Servicii", "Pachete"]);
    await expect(navbar.locator(".site-navbar-links-right > a")).toHaveText(["Galerie", "Întrebări", "Contact"]);
  });

  test("removes the redundant scroll prompt from the hero", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });

    await expect(page.locator(".nr-hero__scroll")).toHaveCount(0);
  });

  test("keeps the hero eyebrow unframed and without a decorative leading rule", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });

    const eyebrow = page.locator(".nr-hero__eyebrow");
    const leadingRuleContent = await eyebrow.evaluate((node) => getComputedStyle(node, "::before").content);

    expect(leadingRuleContent).toBe("none");
  });

  test("uses the approved gallery to packages to anonymous about to partners to brief order", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });

    const order = await page.locator("[data-home-scene]").evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute("data-home-scene")),
    );

    expect(order).toEqual(["gallery", "packages", "about", "partners", "brief"]);
    await expect(page.getByTestId("home-gallery").locator("[data-gallery-item]")).toHaveCount(3);
    await expect(page.getByTestId("home-packages").locator("[data-package-panel]")).toHaveCount(3);
    await expect(page.getByTestId("home-about")).toHaveAttribute("id", "intro");
    await expect(page.getByTestId("home-about").locator("[data-team-person], [data-team-cutout]")).toHaveCount(0);
    await expect(page.getByTestId("home-team")).toHaveCount(0);
    await expect(page.getByTestId("home-partners")).toBeVisible();
    await expect(page.getByTestId("home-brief")).toBeVisible();

    await expect(page.getByTestId("home-gallery").getByRole("link", { name: /galeria/i }))
      .toHaveAttribute("href", "/galerie");
    await expect(page.getByTestId("home-packages").getByRole("link", { name: /pachete/i }))
      .toHaveAttribute("href", "/pachete");
    await expect(page.getByTestId("home-brief").getByRole("link", { name: /conversa/i }))
      .toHaveAttribute("href", "/contact");
  });

  test("uses the approved editorial gallery", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/", { waitUntil: "domcontentloaded" });

    const gallery = page.getByTestId("home-gallery");

    await expect(gallery.locator("[data-gallery-item]")).toHaveCount(3);
    await expect(gallery.locator(".fa-work__meta span")).toHaveCount(0);
    await expect(gallery.locator(".fa-work__outro")).not.toContainText(/05|cadre/i);
    await expect(gallery.locator(".fa-work__intro")).toContainText(/Trei momente\.\s*O singură noapte\./);
    await expect(gallery.locator(".fa-work__outro")).toContainText("Spectacolul continuă.");
    await expect(gallery.locator(".fa-work__intro")).toHaveCSS("text-align", "center");
    await expect(gallery.locator(".fa-work__outro")).toHaveCSS("text-align", "center");
    await expect(gallery.locator(".fa-work__outro").getByRole("link")).toHaveAttribute("href", "/galerie");

    for (const frame of await gallery.locator("[data-gallery-item] figure").all()) {
      await expect(frame).toHaveCSS("border-radius", "0px");
    }
  });

  test("uses three real managed packages without homepage media cards", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });

    const packages = page.getByTestId("home-packages");
    const panels = packages.locator("[data-package-panel]");

    await expect(panels).toHaveCount(3);
    expect(await panels.evaluateAll((nodes) => nodes.map((node) => node.dataset.packageId))).toEqual([
      "fireworks-multicolor-2026",
      "fireworks-gold-2026",
      "fireworks-diamond-piromusical-2026",
    ]);
    await expect(panels.locator("h3")).toHaveText([
      "Multicolor",
      "Gold",
      "Diamond + Piromuzical",
    ]);
    await expect(packages.locator("img, video, [data-package-play], [data-package-youtube]")).toHaveCount(0);
    await expect(page.getByTestId("gallery-package-handoff")).toHaveCount(0);
  });

  test("prefills the quote with the selected real homepage package", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });

    const gold = page.locator('[data-package-panel][data-package-id="fireworks-gold-2026"]');
    await gold.getByRole("button", { name: /cere ofertă/i }).click();

    await expect(page).toHaveURL(/\/contact$/);
    await expect(page.locator("#quote-package")).toHaveValue("fireworks-gold-2026");
    await expect(page.locator("#quote-package option:checked")).toHaveText("Gold");
  });

  test("omits a missing featured package without inventing a replacement", async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("fireartro-managed-content-v1", JSON.stringify({
        packageCatalogVersion: "fireworks-2026-v3",
        packages: [
          {
            id: "fireworks-multicolor-2026",
            title: "Multicolor",
            category: "Artificii de zi",
            duration: "Adaptată momentului",
            bestFor: "Festivități",
            shortDescription: "Efecte vizibile ziua.",
            highlights: ["Culori personalizabile"],
          },
          {
            id: "fireworks-diamond-piromusical-2026",
            title: "Diamond + Piromuzical",
            category: "Artificii de noapte",
            duration: "4 minute",
            bestFor: "Evenimente premium",
            shortDescription: "Spectacol sincronizat pe muzică.",
            highlights: ["Construcție piromuzicală"],
          },
        ],
      }));
    });
    await page.goto("/", { waitUntil: "domcontentloaded" });

    const ids = await page.locator("[data-package-panel]").evaluateAll((nodes) =>
      nodes.map((node) => node.dataset.packageId),
    );
    expect(ids).toEqual([
      "fireworks-multicolor-2026",
      "fireworks-diamond-piromusical-2026",
    ]);
  });

  test("shortens the gallery runway before the package handoff", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/", { waitUntil: "domcontentloaded" });

    const galleryPinHeight = await page.getByTestId("home-gallery").locator(".fa-work__sticky").evaluate((node) => {
      const pinSpacer = node.parentElement;
      return pinSpacer?.classList.contains("pin-spacer") ? pinSpacer.getBoundingClientRect().height : 0;
    });

    expect(galleryPinHeight / 900).toBeGreaterThan(2.3);
    expect(galleryPinHeight / 900).toBeLessThan(2.85);
  });

  test("keeps the about section anonymous without team portraits or member interaction", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const about = page.getByTestId("home-about");

    await expect(about.getByRole("heading", { level: 2 })).toContainText("Un moment reușit");
    await expect(about.locator("img")).toHaveCount(1);
    await expect(about.locator("[data-team-person], [data-team-cutout], button")).toHaveCount(0);
    await expect(page.getByTestId("home-team")).toHaveCount(0);
  });

  test("does not render review UI before a provider connection supplies verified content", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("home-reviews")).toHaveCount(0);
    await expect(page.getByTestId("facebook-reviews")).toHaveCount(0);
  });

  for (const viewport of responsiveViewports) {
    test(`has no horizontal overflow at ${viewport.width}x${viewport.height}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto("/", { waitUntil: "domcontentloaded" });

      const dimensions = await page.evaluate(() => ({
        viewport: document.documentElement.clientWidth,
        page: document.documentElement.scrollWidth,
      }));

      expect(dimensions.page).toBeLessThanOrEqual(dimensions.viewport + 1);
      await expect(page.getByTestId("hero-primary-cta")).toBeVisible();
    });
  }
});
