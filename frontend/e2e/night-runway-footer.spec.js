const { test, expect } = require("@playwright/test");

const routesWithFooter = ["/", "/pachete", "/galerie", "/intrebari-frecvente", "/contact"];

test.describe("Night Runway final CTA and footer", () => {
  test("keeps the footer as the final contact directory", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/", { waitUntil: "domcontentloaded" });

    const footer = page.getByTestId("night-runway-footer");
    await expect(footer).toBeVisible();
    await expect(footer.getByRole("link", { name: "Contact" }).first()).toHaveAttribute("href", "/contact");
    await expect(footer.getByRole("link", { name: "FireArtRo, pagina principală" })).toHaveAttribute("href", "/#acasa");
  });

  test("keeps social, legal and consumer-protection destinations available", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/", { waitUntil: "domcontentloaded" });

    const footer = page.getByTestId("night-runway-footer");
    await expect(footer).toBeVisible();

    await expect(footer.getByRole("link", { name: "Contact" }).first()).toHaveAttribute("href", "/contact");
    await expect(footer.getByRole("link", { name: "Instagram" })).toHaveAttribute("href", /^https:\/\//);
    await expect(footer.getByRole("link", { name: "Facebook" })).toHaveAttribute("href", /^https:\/\//);
    await expect(footer.getByRole("link", { name: "YouTube" })).toHaveAttribute("href", /^https:\/\//);
    await expect(footer.getByRole("link", { name: "Confidențialitate" })).toHaveAttribute("href", "/confidentialitate");
    await expect(footer.getByRole("link", { name: "Termeni și condiții" })).toHaveAttribute("href", "/termeni-si-conditii");
    await expect(footer.getByRole("link", { name: "Cookies" })).toHaveAttribute("href", "/cookies");
    await expect(footer.getByRole("link", { name: "ANPC" })).toHaveAttribute("href", "https://eservicii.anpc.ro/");
    await expect(footer.getByRole("link", { name: "SAL" })).toHaveAttribute("href", "https://reclamatiisal.anpc.ro/");
    await expect(footer.getByRole("button", { name: "Setări cookies" })).toBeVisible();
  });

  test("renders configured phone and WhatsApp actions in the contact directory", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("fireartro-managed-content-v1", JSON.stringify({
        contactSettings: {
          phoneDisplay: "0740 000 000",
          phoneTel: "+40740000000",
          whatsappNumber: "40740000000",
        },
      }));
    });
    await page.goto("/", { waitUntil: "domcontentloaded" });

    const footer = page.getByTestId("night-runway-footer");
    await expect(footer.getByRole("link", { name: "0740 000 000" })).toHaveAttribute("href", "tel:+40740000000");
    await expect(footer.getByRole("link", { name: "WhatsApp" })).toHaveAttribute("href", /^https:\/\/wa\.me\/40740000000/);
  });

  for (const route of routesWithFooter) {
    test(`${route} keeps the footer reachable and keyboard legible`, async ({ page }) => {
      await page.goto(route, { waitUntil: "domcontentloaded" });
      const footer = page.getByTestId("night-runway-footer");
      await expect(footer).toBeVisible();

      const contactLink = footer.getByRole("link", { name: "Contact" }).first();
      await contactLink.focus();
      const focus = await contactLink.evaluate((node) => {
        const styles = getComputedStyle(node);
        return { outlineStyle: styles.outlineStyle, outlineWidth: styles.outlineWidth };
      });
      expect(focus.outlineStyle).not.toBe("none");
      expect(Number.parseFloat(focus.outlineWidth)).toBeGreaterThanOrEqual(2);
    });
  }

  for (const viewport of [
    { width: 390, height: 844 },
    { width: 360, height: 800 },
    { width: 568, height: 320 },
  ]) {
    test(`remains usable without horizontal overflow at ${viewport.width}x${viewport.height}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto("/", { waitUntil: "domcontentloaded" });

      const dimensions = await page.evaluate(() => ({
        viewport: document.documentElement.clientWidth,
        page: document.documentElement.scrollWidth,
      }));
      expect(dimensions.page).toBeLessThanOrEqual(dimensions.viewport + 1);

      const footer = page.getByTestId("night-runway-footer");
      await footer.scrollIntoViewIfNeeded();
      await expect(footer.getByRole("link", { name: "Contact" }).first()).toBeVisible();

      const interactiveHeights = await footer.locator("a, button").evaluateAll((nodes) =>
        nodes.filter((node) => getComputedStyle(node).display !== "none").map((node) => node.getBoundingClientRect().height),
      );
      expect(Math.min(...interactiveHeights)).toBeGreaterThanOrEqual(44);
    });
  }

  test("removes decorative motion when reduced motion is requested", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/", { waitUntil: "domcontentloaded" });

    await expect(page.getByTestId("night-runway-footer")).toHaveCSS("scroll-behavior", "auto");
  });
});
