const { test, expect } = require("@playwright/test");

const FAQ_PATH = "/intrebari-frecvente";

const openFaqPage = async (page) => {
  await page.goto("/");
  await page.evaluate((path) => {
    window.history.pushState({}, "", path);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, FAQ_PATH);
  await expect(page.locator(".nr-faq-page")).toBeVisible();
  await expect(page.locator("h1")).toHaveText("Întrebări.");
};

test.describe("Editorial FAQ", () => {
  test.beforeEach(async ({ page }) => {
    await openFaqPage(page);
  });

  test("presents one concise editorial introduction and one question list", async ({ page }) => {
    await expect(page.getByRole("heading", { level: 1, name: "Întrebări." })).toHaveCount(1);
    await expect(page.getByText("Ce contează înainte de rezervare.")).toBeVisible();

    const questions = page.getByTestId("faq-question");
    await expect(questions).toHaveCount(10);
    await expect(page.getByRole("navigation", { name: "Grupe de întrebări" })).toHaveCount(0);
    await expect(page.getByTestId("faq-contact-media")).toHaveCount(0);
    await expect(page.locator("main img, main video")).toHaveCount(0);

    await expect(page.getByText(/control room|semnal|frecvențe|numărătoare|brief/i)).toHaveCount(0);
  });

  test("supports the complete keyboard accordion flow", async ({ page }) => {
    const triggers = page.getByTestId("faq-question").getByRole("button");
    const first = triggers.nth(0);
    const second = triggers.nth(1);
    const last = triggers.nth(9);

    await first.focus();
    await page.keyboard.press("Enter");
    await expect(first).toHaveAttribute("aria-expanded", "true");

    const firstPanelId = await first.getAttribute("aria-controls");
    await expect(page.locator(`[id="${firstPanelId}"]`)).toBeVisible();

    await page.keyboard.press("ArrowDown");
    await expect(second).toBeFocused();
    await page.keyboard.press("End");
    await expect(last).toBeFocused();
    await page.keyboard.press("Home");
    await expect(first).toBeFocused();

    await page.keyboard.press("Space");
    await expect(first).toHaveAttribute("aria-expanded", "false");
  });

  test("keeps at most one answer open", async ({ page }) => {
    const triggers = page.getByTestId("faq-question").getByRole("button");
    const first = triggers.nth(0);
    const second = triggers.nth(1);

    await first.click();
    await second.click();

    await expect(first).toHaveAttribute("aria-expanded", "false");
    await expect(second).toHaveAttribute("aria-expanded", "true");
    await expect(triggers.locator("[aria-expanded='true']")).toHaveCount(0);
    await expect(page.locator("[data-testid='faq-question'] button[aria-expanded='true']")).toHaveCount(1);
  });

  test("ends with one compact contact action", async ({ page }) => {
    const contact = page.getByTestId("faq-contact-close");

    await expect(contact.getByRole("heading", { name: "Nu ai găsit răspunsul?" })).toBeVisible();
    await expect(contact.getByText("Spune-ne data și locația.")).toBeVisible();
    await expect(contact.getByRole("link", { name: "Contactează-ne" })).toHaveAttribute("href", "/contact");
    await expect(contact.getByRole("link")).toHaveCount(1);
  });

  test("keeps typography, touch targets and width controlled across mobile viewports", async ({ page }) => {
    for (const viewport of [
      { width: 430, height: 932 },
      { width: 390, height: 844 },
      { width: 360, height: 800 },
      { width: 568, height: 320 },
    ]) {
      await page.setViewportSize(viewport);
      await page.reload();
      await expect(page.locator("h1")).toBeVisible();

      const metrics = await page.evaluate(() => {
        const heading = document.querySelector("h1");
        const triggers = [...document.querySelectorAll("[data-testid='faq-question'] button")];
        const headingSize = Number.parseFloat(getComputedStyle(heading).fontSize);
        const smallestTrigger = Math.min(...triggers.map((trigger) => trigger.getBoundingClientRect().height));

        return {
          documentWidth: document.documentElement.scrollWidth,
          viewportWidth: document.documentElement.clientWidth,
          headingSize,
          smallestTrigger,
        };
      });

      expect(metrics.documentWidth, `${viewport.width}x${viewport.height} overflow`).toBeLessThanOrEqual(metrics.viewportWidth + 1);
      expect(metrics.headingSize, `${viewport.width}x${viewport.height} H1`).toBeLessThanOrEqual(48);
      expect(metrics.smallestTrigger, `${viewport.width}x${viewport.height} touch target`).toBeGreaterThanOrEqual(44);
    }
  });

  test("matches visible questions in FAQ structured data", async ({ page }) => {
    const structuredData = await page.locator("script[type='application/ld+json']").evaluateAll((scripts) => (
      scripts.map((script) => JSON.parse(script.textContent)).find((entry) => entry["@type"] === "FAQPage")
    ));

    await expect(page.getByTestId("faq-question")).toHaveCount(structuredData.mainEntity.length);
  });

  test("removes answer motion when reduced motion is requested", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.reload();

    const trigger = page.getByTestId("faq-question").first().getByRole("button");
    await trigger.click();
    const duration = await page.locator(".nr-faq__answer").first().evaluate((element) => {
      const styles = window.getComputedStyle(element);
      return `${styles.animationDuration} ${styles.transitionDuration}`;
    });

    expect(duration).toMatch(/0(?:s|\.001s)|1ms/);
  });
});
