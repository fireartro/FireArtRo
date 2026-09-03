const { test, expect } = require("@playwright/test");

const waitForVisibleNavbar = async (page) => {
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForTimeout(80);
  await page.evaluate(() => window.scrollBy(0, -160));
  await expect(page.getByTestId("main-navbar")).toBeInViewport();
};

const navigateFromNavbar = async (page, target) => {
  const useMobileNavigation = await page.evaluate(() => window.matchMedia("(max-width: 1023px)").matches);
  if (!useMobileNavigation) {
    await page.getByTestId(`nav-link-${target}`).click();
    return;
  }

  const mobileTrigger = page.getByTestId("mobile-menu-trigger");
  await expect(mobileTrigger).toBeInViewport();
  await mobileTrigger.click();
  await page.getByTestId(`mobile-nav-link-${target}`).click();
};

test.describe("FireArt navigation flow", () => {
  test("does not replay a stale shutter after animation frames resume", async ({ page }) => {
    await page.addInitScript(() => {
      const requestFrame = window.requestAnimationFrame.bind(window);
      const pending = [];
      window.__holdRouteFrames = false;
      window.requestAnimationFrame = (callback) => requestFrame((time) => {
        if (window.__holdRouteFrames) pending.push(callback);
        else callback(time);
      });
      window.__resumeRouteFrames = () => {
        window.__holdRouteFrames = false;
        pending.splice(0).forEach((callback) => requestFrame(callback));
      };
    });
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("hero-secondary-cta")).toBeVisible();
    await page.waitForTimeout(1200);
    await page.evaluate(() => {
      window.__holdRouteFrames = true;
      document.querySelector('[data-testid="hero-secondary-cta"]').click();
    });
    await expect(page).toHaveURL(/\/galerie$/);
    await expect(page.getByTestId("route-shutter")).toHaveAttribute("data-active", "false");
    await page.evaluate(() => {
      window.__staleShutterVisible = false;
      const overlay = document.querySelector('[data-testid="route-shutter"]');
      new MutationObserver(() => {
        if (overlay.dataset.active === "false" && getComputedStyle(overlay).visibility !== "hidden") {
          window.__staleShutterVisible = true;
        }
      }).observe(overlay, { attributes: true });
      window.__resumeRouteFrames();
    });
    await page.waitForTimeout(1400);
    expect(await page.evaluate(() => window.__staleShutterVisible)).toBe(false);
    await expect(page.getByTestId("route-shutter")).toHaveCSS("visibility", "hidden");
  });

  test("keeps homepage hash navigation reachable after scrolling to the end", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await waitForVisibleNavbar(page);

    await navigateFromNavbar(page, "intro");
    await expect.poll(() => page.evaluate(() => window.location.hash)).toBe("#intro");
    await expect(page.getByTestId("home-about")).toBeInViewport();

    await navigateFromNavbar(page, "spectacole");
    await expect.poll(() => page.evaluate(() => window.location.hash)).toBe("#spectacole");
    await expect(page.getByTestId("home-gallery")).toBeInViewport();
  });

  test("moves between homepage, gallery, contact, and logo home without losing the route state", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await navigateFromNavbar(page, "contact");
    await page.waitForURL("**/contact");
    await expect(page.getByTestId("contact-section")).toBeVisible();

    await page.getByTestId("nav-logo").click();
    await expect.poll(() => page.evaluate(() => ({
      pathname: window.location.pathname,
      scrollY: window.scrollY,
    }))).toEqual({ pathname: "/", scrollY: 0 });

    await page.goto("/galerie", { waitUntil: "domcontentloaded" });
    await navigateFromNavbar(page, "contact");
    await page.waitForURL("**/contact");
    await expect(page.getByTestId("contact-section")).toBeVisible();
  });

  test("uses the mobile menu for About and the logo home path", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/contact", { waitUntil: "domcontentloaded" });

    await page.getByTestId("mobile-menu-trigger").click();
    await page.getByTestId("mobile-nav-link-intro").click();
    await page.waitForURL("**/#intro");
    await expect(page.getByTestId("home-about")).toBeInViewport();

    await page.getByTestId("mobile-menu-trigger").click();
    await page.getByTestId("nav-logo").last().click();
    await expect.poll(() => page.evaluate(() => ({
      pathname: window.location.pathname,
      scrollY: window.scrollY,
    }))).toEqual({ pathname: "/", scrollY: 0 });
  });
});
