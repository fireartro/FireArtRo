const { test, expect } = require("@playwright/test");

test.describe("FireArt scroll-directed motion", () => {
  test("avoids viewport-sized blur filters at the hero handoff", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });

    const filters = await page.evaluate(() => ({
      gallery: getComputedStyle(document.querySelector(".fa-work__sticky"), "::before").filter,
      packages: getComputedStyle(document.querySelector(".fa-packages"), "::before").filter,
    }));

    expect(filters.gallery).not.toContain("blur(");
    expect(filters.packages).not.toContain("blur(");
  });

  test("builds the three-panel package triptych without the retired service scenes", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/", { waitUntil: "networkidle" });

    const packages = page.getByTestId("home-packages");
    await expect(packages).toHaveAttribute("data-motion", "reveal");
    await expect(packages.locator("[data-package-panel]")).toHaveCount(3);
    await expect(packages.locator("[data-package-triptych]")).toHaveCount(1);
    await expect(packages.locator("[data-package-transition-band]")).toHaveCount(0);
    await expect(packages.locator("[data-package-dock]")).toHaveCount(0);
    expect(await packages.evaluate((node) => Boolean(node.closest(".pin-spacer")))).toBe(false);
    await expect(page.getByTestId("service-stage")).toHaveCount(0);
    await expect(page.getByTestId("section-shutter")).toHaveCount(0);
    await expect(page.getByTestId("home-process")).toHaveCount(0);
  });

  test("uses the real gallery outro once and starts packages in normal flow", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/", { waitUntil: "domcontentloaded" });

    const gallery = page.getByTestId("home-gallery");
    const packages = page.getByTestId("home-packages");

    await expect(gallery.getByText("Spectacolul continuă.", { exact: true })).toHaveCount(1);
    await expect(packages.getByText("Spectacolul continuă.", { exact: true })).toHaveCount(0);
    await expect(page.getByTestId("gallery-package-handoff")).toHaveCount(0);
    await expect(packages).toHaveCSS("margin-top", "0px");

    const packageHeight = await packages.evaluate((node) => node.getBoundingClientRect().height);
    const viewportHeight = await page.evaluate(() => window.innerHeight);
    expect(packageHeight).toBeLessThan(viewportHeight * 3);
  });

  test("uses one warmed WebGL canvas only for the partner orbit", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/", { waitUntil: "domcontentloaded" });

    const partners = page.getByTestId("home-partners");
    await expect(partners.locator("canvas")).toHaveCount(1);
    await expect(partners).toHaveAttribute("data-gpu", /warming|ready/);
    await expect(page.locator("canvas")).toHaveCount(1);
    await expect(partners.locator("[data-partner-name]")).toHaveCount(12);
  });

  test("renders readable static fallbacks for reduced motion", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 430, height: 932 });
    await page.goto("/", { waitUntil: "domcontentloaded" });

    const packages = page.getByTestId("home-packages");
    await expect(packages).toHaveAttribute("data-motion", "static");
    await expect(packages.locator("[data-package-panel]")).toHaveCount(3);
    for (const panel of await packages.locator("[data-package-panel]").all()) {
      await expect(panel).toBeVisible();
      const settled = await panel.evaluate((node) => {
        const style = getComputedStyle(node);
        return { opacity: Number.parseFloat(style.opacity), transform: style.transform };
      });
      expect(settled.opacity).toBeGreaterThanOrEqual(0.99);
      expect(settled.transform).toBe("none");
    }
    await expect(page.getByTestId("home-partners").locator("canvas")).toHaveCount(0);
    await expect(page.getByTestId("home-partners").locator("[data-partner-name]")).toHaveCount(12);
  });

  test("keeps route transitions in a neutral cinematic black", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto("/", { waitUntil: "domcontentloaded" });

    const overlay = page.getByTestId("route-shutter");
    const routeBands = overlay.locator("[data-route-band]");
    await expect(routeBands).toHaveCount(10);
    const bandColors = await routeBands.evaluateAll((nodes) =>
      nodes.map((node) => getComputedStyle(node).backgroundColor),
    );
    expect(bandColors).toEqual(Array(10).fill("rgb(1, 1, 2)"));
  });
});
