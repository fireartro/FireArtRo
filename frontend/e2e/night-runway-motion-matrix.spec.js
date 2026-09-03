const { test, expect } = require("@playwright/test");

test.describe("FireArt motion matrix", () => {
  test("selects an animation path for every supported browser and input type", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });

    const gallery = page.getByTestId("home-gallery");
    const packages = page.getByTestId("home-packages");

    await expect(gallery).toHaveAttribute("data-motion", "scroll");
    await expect(packages).toHaveAttribute("data-motion", "reveal");
    expect(await packages.evaluate((node) => Boolean(node.closest(".pin-spacer")))).toBe(false);
  });
});
