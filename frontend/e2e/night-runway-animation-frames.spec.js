const { test, expect } = require("@playwright/test");

const consent = {
  necessary: true,
  analytics: false,
  marketing: false,
  savedAt: "2026-08-01T00:00:00.000Z",
  expiresAt: "2027-08-01T00:00:00.000Z",
};

const progressFrames = Array.from({ length: 12 }, (_, index) => index / 11);

async function settleFrame(page) {
  await page.evaluate(async () => {
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
  await page.waitForTimeout(120);
}

async function sceneRange(section, stickySelector) {
  return section.evaluate((node, selector) => {
    const sticky = node.querySelector(selector);
    let pinnedParent = sticky?.parentElement;
    while (pinnedParent && !pinnedParent.classList.contains("pin-spacer")) {
      pinnedParent = pinnedParent.parentElement;
    }

    const holder = sticky === node ? node : (pinnedParent || node);
    const start = holder.getBoundingClientRect().top + window.scrollY;
    const range = Math.max(1, holder.offsetHeight - window.innerHeight);
    return { start, range };
  }, stickySelector);
}

async function captureScrollFrames(page, section, stickySelector, prefix, testInfo) {
  const { start, range } = await sceneRange(section, stickySelector);
  const captures = [];

  for (const [index, progress] of progressFrames.entries()) {
    await page.evaluate(({ y }) => window.scrollTo({ top: y, behavior: "auto" }), {
      y: start + range * progress,
    });
    await settleFrame(page);
    const path = testInfo.outputPath(`${prefix}-${String(index).padStart(2, "0")}.png`);
    await page.screenshot({ path, fullPage: false });
    captures.push(path);
  }

  return captures;
}

test.describe("FireArt animation frame matrix", () => {
  test.setTimeout(120_000);

  test("captures every home animation and transition at controlled scroll progress", async ({ page }, testInfo) => {
    await page.addInitScript((storedConsent) => {
      window.localStorage.setItem("fireartro-cookie-consent-v1", JSON.stringify(storedConsent));
    }, consent);
    await page.goto("/", { waitUntil: "domcontentloaded" });

    const hero = page.getByTestId("hero-section");
    const gallery = page.getByTestId("home-gallery");
    const packages = page.getByTestId("home-packages");
    const about = page.getByTestId("home-about");
    const partners = page.getByTestId("home-partners");
    const brief = page.getByTestId("home-brief");

    await expect(hero).toBeVisible();
    await expect(gallery).toHaveAttribute("data-motion", "scroll");
    await expect(packages).toHaveAttribute("data-motion", "reveal");

    for (const [index, delay] of [0, 350, 900, 1_700].entries()) {
      if (delay) await page.waitForTimeout(delay - [0, 350, 900, 1_700][index - 1]);
      await page.screenshot({ path: testInfo.outputPath(`hero-${String(index).padStart(2, "0")}.png`), fullPage: false });
    }

    const galleryTrack = gallery.locator(".fa-work__track");
    const galleryInitialTransform = await galleryTrack.evaluate((element) => getComputedStyle(element).transform);
    await captureScrollFrames(page, gallery, ".fa-work__sticky", "gallery", testInfo);
    const galleryFinalTransform = await galleryTrack.evaluate((element) => getComputedStyle(element).transform);
    expect(galleryFinalTransform).not.toBe(galleryInitialTransform);

    await packages.scrollIntoViewIfNeeded();
    await settleFrame(page);
    await page.screenshot({ path: testInfo.outputPath("packages-triptych.png"), fullPage: false });
    await expect(packages.locator("[data-package-panel]")).toHaveCount(3);

    await about.scrollIntoViewIfNeeded();
    await settleFrame(page);
    await expect(about.locator("[data-team-person], [data-team-cutout]")).toHaveCount(0);
    await page.screenshot({ path: testInfo.outputPath("about.png"), fullPage: false });

    await captureScrollFrames(page, partners, ".fa-partners__sticky", "partners", testInfo);
    await captureScrollFrames(page, brief, ".fa-brief", "brief", testInfo);

    const dimensions = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      page: document.documentElement.scrollWidth,
    }));
    expect(dimensions.page).toBeLessThanOrEqual(dimensions.viewport + 1);
  });
});
