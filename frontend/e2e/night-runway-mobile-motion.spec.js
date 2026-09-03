const { test, expect, devices } = require("@playwright/test");

const iphone14 = devices["iPhone 14"];

test.use({
  userAgent: iphone14.userAgent,
  viewport: iphone14.viewport,
  deviceScaleFactor: iphone14.deviceScaleFactor,
  isMobile: iphone14.isMobile,
  hasTouch: iphone14.hasTouch,
});

const scrollPage = async (page, amount) => {
  await page.evaluate((delta) => window.scrollBy(0, delta), amount);
  await page.waitForTimeout(300);
};

test.describe("FireArt touch motion", () => {
  test("uses gallery scroll and package reveal motion on touch", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });

    const gallery = page.getByTestId("home-gallery");
    const packages = page.getByTestId("home-packages");

    await expect(gallery).toHaveAttribute("data-motion", "scroll");
    await expect(packages).toHaveAttribute("data-motion", "reveal");
    expect(await packages.evaluate((node) => Boolean(node.closest(".pin-spacer")))).toBe(false);

    await gallery.scrollIntoViewIfNeeded();
    await scrollPage(page, 420);
    await expect(gallery.locator(".fa-work__track")).not.toHaveCSS("transform", "none");

    await packages.evaluate((node) => {
      document.documentElement.style.scrollBehavior = "auto";
      node.scrollIntoView({ block: "start", behavior: "auto" });
      // Playwright WebKit can defer native scroll delivery after an instant
      // programmatic jump. Dispatching the event validates the synchronous
      // fallback used by real touch scrolling without testing the runner's
      // frame scheduler.
      window.dispatchEvent(new Event("scroll"));
    });
    // Let WebKit deliver its scroll and animation-frame callbacks outside a
    // page.evaluate task; an in-page timer can keep rendering suspended.
    await page.waitForTimeout(160);
    const endState = await gallery.evaluate((section) => {
      const viewport = section.querySelector(".fa-work__viewport");
      const track = section.querySelector(".fa-work__track");
      const matrix = new DOMMatrixReadOnly(getComputedStyle(track).transform);
      const travel = Math.max(1, track.scrollWidth - viewport.clientWidth);
      return {
        progress: Math.abs(matrix.m41) / travel,
        scrollY: window.scrollY,
        maxScroll: document.documentElement.scrollHeight - window.innerHeight,
      };
    });
    expect(endState.progress, JSON.stringify(endState)).toBeGreaterThanOrEqual(0.96);

    await packages.scrollIntoViewIfNeeded();
    for (const panel of await packages.locator("[data-package-panel]").all()) {
      await expect(panel).toBeVisible();
      await expect.poll(() => panel.evaluate((node) => Number.parseFloat(getComputedStyle(node).opacity)))
        .toBeGreaterThanOrEqual(0.99);
    }
  });
});
