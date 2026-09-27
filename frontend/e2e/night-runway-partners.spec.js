const { test, expect } = require("@playwright/test");
const seed = require('../src/content/__fixtures__/siteContent.json');

test.beforeEach(async ({ page }) => {
  const content = JSON.parse(JSON.stringify(seed));
  content.partners = Array.from({ length: 12 }, (_, index) => {
    const name = `PARTENER ${String(index + 1).padStart(2, '0')}`;
    return { id: `partner-${index + 1}`, name, logoPlaceholder: name, replaceable: true, logoMediaId: '' };
  });
  content.homePage.partners.title = 'Împreună, dincolo de spectacol.';
  content.homePage.partners.eyebrow = 'Un show se construiește împreună';
  content.homePage.partners.ctaLabel = '';
  content.homePage.partners.ctaHref = '';
  await page.route('**/api/content', route => route.fulfill({ json: { content, revision_id: 'partner-qa', published_at: '2026-09-27T00:00:00Z' } }));
  await page.route('**/api/content/revision', route => route.fulfill({ json: { revision_id: 'partner-qa', published_at: '2026-09-27T00:00:00Z' } }));
});

for (const width of [320, 390, 430, 768, 1024, 1440]) {
  test(`partner scene keeps marks clear of the copy and viewport at ${width}px`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.setViewportSize({ width, height: width < 600 ? 844 : 900 });
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const scene = page.getByTestId("partner-cloud");
    await expect(scene.locator(".fa-partner")).toHaveCount(26);
    await expect(scene).toHaveAttribute("data-view", "cloud");

    const collisions = await scene.evaluate(element => {
      const copy = element.querySelector(".fa-partner-cloud__copy").getBoundingClientRect();
      const cards = [...element.querySelectorAll(".fa-partner")]
        .filter(node => getComputedStyle(node).display !== "none")
        .map(node => ({ id: node.dataset.partnerId, box: node.querySelector(".fa-partner__float").getBoundingClientRect() }));
      const overlaps = (a, b, gap = 4) => a.left < b.right + gap && a.right + gap > b.left && a.top < b.bottom + gap && a.bottom + gap > b.top;
      const viewport = document.documentElement.clientWidth;
      return {
        count: cards.length,
        copy: cards.filter(card => overlaps(card.box, copy, 8)).map(card => card.id),
        edges: cards.filter(card => card.box.left < 0 || card.box.right > viewport).map(card => card.id),
        pairs: cards.flatMap((card, index) => cards.slice(index + 1).filter(other => overlaps(card.box, other.box)).map(other => `${card.id}/${other.id}`)),
      };
    });
    expect(collisions.count).toBe(width < 600 ? 10 : 26);
    expect(collisions.copy).toEqual([]);
    expect(collisions.edges).toEqual([]);
    expect(collisions.pairs).toEqual([]);
  });
}

test("phone list reveals every authentic mark and typographic fallback", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const scene = page.getByTestId("partner-cloud");
  await expect(scene.locator(".fa-partner")).toHaveCount(26);
  await scene.getByRole("button", { name: /Vezi toți cei 26 parteneri/ }).click();
  await expect(scene).toHaveAttribute("data-view", "list");
  await expect(scene.locator(".fa-partner:visible")).toHaveCount(26);
  await expect(scene.locator('[data-partner-id="infinity"] img')).toHaveCount(0);
  await expect(scene.locator('[data-partner-id="palatul"] img')).toHaveCount(0);
});
