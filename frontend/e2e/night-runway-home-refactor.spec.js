const { test, expect } = require("@playwright/test");

const reviewApiPayload = {
  providers: [
    {
      id: "facebook",
      href: "https://www.facebook.com/FireArtRo/reviews",
      reviews: [{
        id: "facebook-live-1",
        provider: "facebook",
        author: "Client Facebook",
        text: "Un spectacol construit atent.",
        rating: 5,
        published_at: "2026-08-18T20:00:00Z",
        url: "",
      }],
    },
    {
      id: "google",
      href: "https://www.google.com/maps/place/FireArtRo",
      reviews: [{
        id: "google-live-1",
        provider: "google",
        author: "Client Google",
        text: "Execuție foarte bine coordonată.",
        rating: 5,
        published_at: "2026-08-20T18:30:00Z",
        url: "https://www.google.com/maps/reviews/google-live-1",
      }],
    },
  ],
};

async function mockPublicReviews(page, payload = reviewApiPayload) {
  await page.route("**/api/reviews", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(payload),
  }));
}

const necessaryConsent = {
  necessary: true,
  analytics: false,
  marketing: false,
  savedAt: "2026-08-31T00:00:00.000Z",
  expiresAt: "2099-08-31T00:00:00.000Z",
};

async function scrollInstantly(page, top) {
  await page.evaluate(async (nextTop) => {
    const root = document.documentElement;
    const previousBehavior = root.style.scrollBehavior;

    root.style.scrollBehavior = "auto";
    window.scrollTo({ top: nextTop, behavior: "auto" });
    await new Promise(requestAnimationFrame);
    await new Promise(requestAnimationFrame);
    root.style.scrollBehavior = previousBehavior;
  }, top);
}

test.describe("FireArt homepage structural refactor", () => {
  test("routes homepage anchors from gallery and keeps the active indicator consistent", async ({ page }) => {
    await page.goto("/galerie", { waitUntil: "domcontentloaded" });

    const aboutLink = page.getByTestId("nav-link-intro");
    if ((page.viewportSize()?.width || 0) >= 900) {
      await expect(aboutLink).toBeVisible();
      await aboutLink.click();
    } else {
      await expect(page.getByTestId("mobile-menu-trigger")).toBeVisible();
      await page.getByTestId("mobile-menu-trigger").click();
      await page.getByTestId("mobile-nav-link-intro").click();
    }

    await expect(page).toHaveURL(/\/#intro$/);
    await expect(page.locator('[data-testid$="nav-link-intro"][aria-current="page"]')).toHaveCount(1);
    await expect(page.locator("#intro")).toBeInViewport();
  });

  test("keeps review rails completely absent until verified provider data exists", async ({ page }) => {
    await mockPublicReviews(page, { providers: [] });
    await page.goto("/", { waitUntil: "domcontentloaded" });

    await expect(page.getByTestId("home-reviews")).toHaveCount(0);
    await expect(page.getByTestId("facebook-reviews")).toHaveCount(0);
    await expect(page.locator(".fa-footer__lead")).toHaveCount(0);
  });

  test("uses a catalog drone image for the first home gallery card", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });

    await expect(page.getByTestId("home-gallery").locator("[data-gallery-item] img").first())
      .toHaveAttribute("src", /fireartro-drone-show-focsani-dji-0768-enhanced-nr\.webp/);
  });

  test("renders compact opposite-direction review rails only for verified provider data", async ({ page }) => {
    await mockPublicReviews(page);
    await page.goto("/", { waitUntil: "domcontentloaded" });

    const reviews = page.getByTestId("home-reviews");
    await expect(reviews).toBeVisible();
    await expect(reviews.locator("h2")).toHaveCount(0);
    await expect(reviews.locator("[data-review-provider='facebook']")).toHaveAttribute("data-direction", "right-to-left");
    await expect(reviews.locator("[data-review-provider='google']")).toHaveAttribute("data-direction", "left-to-right");
    await expect(reviews.locator("[data-review-card]")).toHaveCount(2);
    await expect(reviews.locator(".fa-page-reviews__group")).toHaveCount(4);
    await expect(reviews.locator("[data-review-provider='facebook'] .fa-page-reviews__track"))
      .toHaveCSS("animation-name", "pageReviewRailLeft");
    await expect(reviews.locator("[data-review-provider='google'] .fa-page-reviews__track"))
      .toHaveCSS("animation-name", "pageReviewRailRight");
    await expect(reviews.locator("[data-review-card]").first()).toHaveCSS("border-radius", "0px");
    await reviews.locator("[data-review-provider='facebook']").hover();
    await expect(reviews.locator("[data-review-provider='facebook'] .fa-page-reviews__track"))
      .toHaveCSS("animation-play-state", "paused");
    await expect(reviews.getByRole("link", { name: /Facebook/i })).toBeVisible();
    await expect(reviews.getByRole("link", { name: /Google/i })).toBeVisible();

    await expect(reviews).toHaveClass(/fa-page-reviews/);
    await expect(reviews.locator("xpath=ancestor::footer[contains(@class, 'fa-footer')]")).toHaveCount(0);
    await expect(reviews.locator("xpath=following-sibling::footer[1]")).toHaveCount(1);
  });

  test("places connected reviews immediately before the footer on every public page", async ({ page }) => {
    await mockPublicReviews(page);

    for (const route of [
      "/",
      "/galerie",
      "/pachete",
      "/intrebari-frecvente",
      "/contact",
      "/blog",
      "/confidentialitate",
      "/termeni-si-conditii",
      "/cookies",
    ]) {
      await page.goto(route, { waitUntil: "domcontentloaded" });
      const reviews = page.getByTestId("home-reviews");
      await expect(reviews).toBeVisible();
      await expect(reviews.locator("xpath=following-sibling::footer[1]")).toHaveCount(1);
      await expect(reviews.locator("xpath=ancestor::footer[contains(@class, 'fa-footer')]")).toHaveCount(0);
    }
  });

  test("lays out the text-only package triptych without viewport overflow", async ({ page }) => {
    test.setTimeout(60_000);
    await page.addInitScript((consent) => {
      window.localStorage.setItem("fireartro-cookie-consent-v1", JSON.stringify(consent));
    }, necessaryConsent);

    for (const viewport of [
      { width: 1440, height: 900, columns: true },
      { width: 1138, height: 872, columns: true },
      { width: 1024, height: 768, columns: true },
      { width: 1024, height: 1366, columns: false },
      { width: 912, height: 1368, columns: false },
      { width: 834, height: 1194, columns: false },
      { width: 430, height: 932, columns: false },
      { width: 390, height: 844, columns: false },
      { width: 932, height: 430, columns: false },
      { width: 844, height: 390, columns: false },
      { width: 568, height: 320, columns: false },
    ]) {
      await page.setViewportSize(viewport);
      await page.goto("/", { waitUntil: "domcontentloaded" });

      const packages = page.getByTestId("home-packages");
      const boxes = await packages.locator("[data-package-panel]").evaluateAll((nodes) =>
        nodes.map((node) => {
          const rect = node.getBoundingClientRect();
          return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
        }),
      );
      expect(boxes).toHaveLength(3);

      if (viewport.columns) {
        expect(Math.max(...boxes.map((box) => box.y)) - Math.min(...boxes.map((box) => box.y))).toBeLessThan(4);
      } else {
        expect(boxes[1].y).toBeGreaterThan(boxes[0].y + boxes[0].height - 2);
        expect(boxes[2].y).toBeGreaterThan(boxes[1].y + boxes[1].height - 2);
      }

      const width = await page.evaluate(() => ({
        client: document.documentElement.clientWidth,
        scroll: document.documentElement.scrollWidth,
      }));
      expect(width.scroll).toBeLessThanOrEqual(width.client + 1);
    }

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.addStyleTag({ content: "html { font-size: 200% !important; }" });

    const packages = page.getByTestId("home-packages");
    const panels = packages.locator("[data-package-panel]");
    await expect(panels).toHaveCount(3);
    await packages.scrollIntoViewIfNeeded();

    for (const panel of await panels.all()) {
      const box = await panel.boundingBox();
      expect(box.x).toBeGreaterThanOrEqual(-1);
      expect(box.x + box.width).toBeLessThanOrEqual(391);
      await expect(panel.getByRole("button", { name: /cere ofertă/i })).toBeVisible();
    }
    const zoomWidth = await page.evaluate(() => ({
      client: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth,
    }));
    expect(zoomWidth.scroll).toBeLessThanOrEqual(zoomWidth.client + 1);
  });

  test("reveals a package panel synchronously when its CTA receives focus", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/", { waitUntil: "domcontentloaded" });

    const focusState = await page.getByTestId("home-packages").evaluate((section) => {
      const panel = section.querySelector("[data-package-panel]");
      const button = panel?.querySelector("[data-package-request]");
      button?.focus({ preventScroll: true });

      const style = panel ? getComputedStyle(panel) : null;
      const matrix = style?.transform === "none"
        ? null
        : new DOMMatrixReadOnly(style?.transform);

      return {
        active: document.activeElement === button,
        opacity: Number.parseFloat(style?.opacity || "0"),
        translateY: matrix?.m42 || 0,
      };
    });

    expect(focusState.active).toBe(true);
    expect(focusState.opacity).toBeGreaterThanOrEqual(0.99);
    expect(Math.abs(focusState.translateY)).toBeLessThanOrEqual(0.5);
  });

  test("keeps the desktop package triptych header and scene compact", async ({ page }) => {
    const viewport = { width: 1138, height: 872 };
    await page.setViewportSize(viewport);
    await page.goto("/", { waitUntil: "domcontentloaded" });

    const metrics = await page.getByTestId("home-packages").evaluate((section) => {
      const sectionRect = section.getBoundingClientRect();
      const header = section.querySelector(".fa-packages__header").getBoundingClientRect();
      const heading = section.querySelector("h2").getBoundingClientRect();
      const triptych = section.querySelector("[data-package-triptych]").getBoundingClientRect();
      const panelHeights = Array.from(section.querySelectorAll("[data-package-panel]"), (panel) => (
        panel.getBoundingClientRect().height
      ));
      const targetSizes = Array.from(section.querySelectorAll("a[href], button:not([disabled])"), (target) => {
        const rect = target.getBoundingClientRect();
        return { width: rect.width, height: rect.height };
      });

      return {
        sectionHeight: sectionRect.height,
        paddingTop: Number.parseFloat(getComputedStyle(section).paddingTop),
        headingFontSize: Number.parseFloat(getComputedStyle(section.querySelector("h2")).fontSize),
        headerHeight: header.height,
        triptychTopOffset: triptych.top - sectionRect.top,
        tallestPanel: Math.max(...panelHeights),
        targetSizes,
      };
    });

    expect(metrics.paddingTop).toBeLessThanOrEqual(84);
    expect(metrics.headingFontSize).toBeLessThanOrEqual(56);
    expect(metrics.headerHeight).toBeLessThanOrEqual(viewport.height * 0.24);
    expect(metrics.triptychTopOffset).toBeLessThanOrEqual(viewport.height * 0.36);
    expect(metrics.tallestPanel).toBeLessThanOrEqual(viewport.height * 0.66);
    expect(metrics.sectionHeight).toBeLessThanOrEqual(viewport.height * 1.25);
    expect(metrics.targetSizes).toHaveLength(4);
    for (const target of metrics.targetSizes) {
      expect(target.width).toBeGreaterThanOrEqual(44);
      expect(target.height).toBeGreaterThanOrEqual(44);
    }
  });

  test("keeps mobile gallery photos and the outro full-width", async ({ page }) => {
    for (const viewport of [
      { width: 390, height: 844 },
      { width: 834, height: 1194 },
      { width: 912, height: 1368 },
      { width: 1024, height: 1366 },
    ]) {
      await page.setViewportSize(viewport);
      await page.goto("/", { waitUntil: "domcontentloaded" });

      const gallery = page.getByTestId("home-gallery");
      const cards = gallery.locator("[data-gallery-item]");
      const outro = gallery.locator(".fa-work__outro");
      await expect(cards).toHaveCount(3);
      const sceneWidth = await page.getByTestId("home-gallery").locator(".fa-work__viewport")
        .evaluate((node) => node.clientWidth);
      for (const card of await cards.all()) {
        const box = await card.boundingBox();
        expect(Math.abs(box.width - sceneWidth)).toBeLessThanOrEqual(2);
      }
      const outroBox = await outro.boundingBox();
      expect(outroBox.width / sceneWidth).toBeGreaterThanOrEqual(0.98);
      expect(outroBox.width / sceneWidth).toBeLessThanOrEqual(1.02);
    }
  });

  test("keeps the final mobile photo visible while the gallery outro settles", async ({ page }) => {
    await page.addInitScript((consent) => {
      window.localStorage.setItem("fireartro-cookie-consent-v1", JSON.stringify(consent));
    }, necessaryConsent);
    await page.setViewportSize({ width: 834, height: 1194 });
    await page.goto("/", { waitUntil: "domcontentloaded" });

    const gallery = page.getByTestId("home-gallery");
    const range = await gallery.locator(".fa-work__sticky").evaluate((sticky) => {
      const holder = sticky.parentElement?.classList.contains("pin-spacer") ? sticky.parentElement : sticky;
      return {
        start: holder.getBoundingClientRect().top + window.scrollY,
        distance: holder.offsetHeight - window.innerHeight,
      };
    });
    await scrollInstantly(page, range.start + range.distance * 0.94);

    await expect.poll(async () => gallery.evaluate((section) => {
      const viewport = section.querySelector(".fa-work__viewport").getBoundingClientRect();
      const outro = section.querySelector(".fa-work__outro").getBoundingClientRect();
      const visibleWidth = Math.max(0, Math.min(outro.right, viewport.right) - Math.max(outro.left, viewport.left));
      return visibleWidth / viewport.width;
    })).toBeGreaterThanOrEqual(0.7);

    const overlap = await gallery.evaluate((section) => {
      const viewport = section.querySelector(".fa-work__viewport").getBoundingClientRect();
      const lastCard = section.querySelector("[data-gallery-item]:last-of-type").getBoundingClientRect();
      const outro = section.querySelector(".fa-work__outro").getBoundingClientRect();
      const visibleWidth = (rect) => Math.max(0, Math.min(rect.right, viewport.right) - Math.max(rect.left, viewport.left));
      return {
        sceneWidth: viewport.width,
        lastCard: visibleWidth(lastCard),
        outro: visibleWidth(outro),
      };
    });

    expect(overlap.lastCard / overlap.sceneWidth).toBeGreaterThanOrEqual(0.18);
    expect(overlap.outro / overlap.sceneWidth).toBeGreaterThanOrEqual(0.7);
  });

  test("holds back the gallery outro copy until its mobile panel is readable", async ({ page }) => {
    await page.addInitScript((consent) => {
      window.localStorage.setItem("fireartro-cookie-consent-v1", JSON.stringify(consent));
    }, necessaryConsent);
    await page.setViewportSize({ width: 834, height: 1194 });
    await page.goto("/", { waitUntil: "domcontentloaded" });

    const gallery = page.getByTestId("home-gallery");
    const range = await gallery.locator(".fa-work__sticky").evaluate((sticky) => {
      const holder = sticky.parentElement?.classList.contains("pin-spacer") ? sticky.parentElement : sticky;
      return {
        start: holder.getBoundingClientRect().top + window.scrollY,
        distance: Math.max(1, holder.offsetHeight - window.innerHeight),
      };
    });

    await scrollInstantly(page, range.start + range.distance * 0.9);
    await expect.poll(async () => Number.parseFloat(
      await gallery.locator(".fa-work__outro-inner").evaluate((node) => getComputedStyle(node).opacity),
    )).toBeGreaterThanOrEqual(0.06);
    await expect(gallery.locator(".fa-work__outro-inner")).toHaveCSS("opacity", /^(0|0\.\d+)$/);
    const enteringOpacity = Number.parseFloat(
      await gallery.locator(".fa-work__outro-inner").evaluate((node) => getComputedStyle(node).opacity),
    );
    expect(enteringOpacity).toBeLessThanOrEqual(0.15);

    await scrollInstantly(page, range.start + range.distance * 0.93);
    await expect.poll(async () => Number.parseFloat(
      await gallery.locator(".fa-work__outro-inner").evaluate((node) => getComputedStyle(node).opacity),
    )).toBeGreaterThanOrEqual(0.25);
    const settlingOpacity = Number.parseFloat(
      await gallery.locator(".fa-work__outro-inner").evaluate((node) => getComputedStyle(node).opacity),
    );
    expect(settlingOpacity).toBeGreaterThanOrEqual(0.25);
    expect(settlingOpacity).toBeLessThanOrEqual(0.55);

    await scrollInstantly(page, range.start + range.distance);
    await expect.poll(async () => Number.parseFloat(
      await gallery.locator(".fa-work__outro-inner").evaluate((node) => getComputedStyle(node).opacity),
    )).toBeGreaterThanOrEqual(0.99);
  });

  test("recalculates the gallery frame immediately after phone and tablet rotation", async ({ page }) => {
    await page.setViewportSize({ width: 430, height: 932 });
    await page.goto("/", { waitUntil: "domcontentloaded" });

    for (const viewport of [
      { width: 932, height: 430 },
      { width: 1024, height: 1366 },
      { width: 1366, height: 1024 },
      { width: 430, height: 932 },
    ]) {
      await page.setViewportSize(viewport);
      const gallery = page.getByTestId("home-gallery");

      await expect.poll(async () => gallery.evaluate((section) => {
        const viewportNode = section.querySelector(".fa-work__viewport");
        const panel = section.querySelector("[data-gallery-panel]");
        const sceneWidth = Number.parseFloat(getComputedStyle(section).getPropertyValue("--nr-scene-width"));
        const compactScene = window.matchMedia(
          "(max-width: 899px), (hover: none) and (pointer: coarse), "
            + "(min-width: 900px) and (max-width: 1199px) and (orientation: portrait), "
            + "(min-width: 900px) and (max-width: 999px) and (max-height: 560px) and (orientation: landscape)",
        ).matches;
        const rootSize = Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
        const fluidPanelWidth = Math.min(
          Math.max(48 * rootSize, window.innerWidth * 0.64),
          84 * rootSize,
        );
        const expectedPanelWidth = compactScene
          ? viewportNode.clientWidth
          : Math.min(viewportNode.clientWidth, fluidPanelWidth);
        return Math.max(
          Math.abs(sceneWidth - viewportNode.clientWidth),
          Math.abs(panel.getBoundingClientRect().width - expectedPanelWidth),
        );
      })).toBeLessThanOrEqual(2);

      const overflow = await page.evaluate(() => ({
        client: document.documentElement.clientWidth,
        scroll: document.documentElement.scrollWidth,
      }));
      expect(overflow.scroll).toBeLessThanOrEqual(overflow.client + 1);
    }
  });

  test("keeps gallery photos framed for touch landscape phones", async ({ page }) => {
    for (const viewport of [
      { width: 568, height: 320 },
      { width: 844, height: 390 },
      { width: 932, height: 430 },
    ]) {
      await page.setViewportSize(viewport);
      await page.goto("/", { waitUntil: "domcontentloaded" });

      const figures = page.getByTestId("home-gallery").locator("[data-gallery-item] figure");
      for (const figure of await figures.all()) {
        const box = await figure.boundingBox();
        expect(box.width / box.height, "landscape phone photos should not become ultra-wide crops").toBeLessThanOrEqual(2.1);
        expect(box.height, "photos should use the available short-viewport height").toBeGreaterThanOrEqual(viewport.height * 0.45);
        expect(box.height, "photos must leave room for navigation and captions").toBeLessThanOrEqual(viewport.height - 150);
      }
    }
  });

  test("eases touch-driven gallery travel across multiple animation frames", async ({ page }) => {
    await page.setViewportSize({ width: 430, height: 932 });
    await page.goto("/", { waitUntil: "domcontentloaded" });

    const gallery = page.getByTestId("home-gallery");
    const range = await gallery.locator(".fa-work__sticky").evaluate((sticky) => {
      const holder = sticky.parentElement?.classList.contains("pin-spacer") ? sticky.parentElement : sticky;
      return {
        start: holder.getBoundingClientRect().top + window.scrollY,
        distance: Math.max(1, holder.offsetHeight - window.innerHeight),
      };
    });
    await scrollInstantly(page, range.start);

    const samples = await gallery.locator(".fa-work__track").evaluate(async (track, targetY) => {
      const root = document.documentElement;
      const previousBehavior = root.style.scrollBehavior;
      const x = () => new DOMMatrixReadOnly(getComputedStyle(track).transform).m41;
      const values = [x()];
      root.style.scrollBehavior = "auto";
      window.scrollTo({ top: targetY, behavior: "auto" });
      for (let index = 0; index < 8; index += 1) {
        await new Promise((resolve) => window.requestAnimationFrame(resolve));
        values.push(x());
      }
      root.style.scrollBehavior = previousBehavior;
      return values;
    }, range.start + range.distance * 0.35);

    const rounded = samples.map((value) => Math.round(value));
    const distinct = new Set(rounded);
    const totalTravel = Math.abs(samples[samples.length - 1] - samples[0]);
    const largestFrameStep = Math.max(
      ...samples.slice(1).map((value, index) => Math.abs(value - samples[index])),
    );

    expect(distinct.size, "gallery motion should progress through intermediate frames").toBeGreaterThanOrEqual(4);
    expect(totalTravel, "gallery should visibly travel after the scroll input").toBeGreaterThan(40);
    expect(largestFrameStep / totalTravel, "no frame should contain most of the horizontal jump")
      .toBeLessThan(0.55);
  });

  test("uses a concise brief after the conditional reviews slot and a quiet directory footer", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });

    const brief = page.getByTestId("home-brief");
    await expect(brief).toContainText(/Spune-ne ce sărbătorești\.\s*Noi aprindem restul\./);
    await expect(brief.getByRole("link", { name: /conversația/i })).toHaveAttribute("href", "/contact");

    const footer = page.getByTestId("night-runway-footer");
    await expect(footer.locator(".fa-footer__lead")).toHaveCount(0);
    await expect(footer.getByRole("navigation", { name: "Explorează" })).toBeVisible();
    await expect(footer.getByRole("navigation", { name: "Urmărește" })).toBeVisible();
    await expect(footer.getByText("Drone show, artificii și efecte construite pentru momentul potrivit.")).toBeVisible();
  });
});
