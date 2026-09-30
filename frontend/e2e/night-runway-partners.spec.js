const { test, expect } = require("@playwright/test");
const seed = require("../src/content/__fixtures__/siteContent.json");
const defaultContent = JSON.parse(JSON.stringify(seed));
defaultContent.partners = Array.from({ length: 12 }, (_, index) => {
  const name = `PARTENER ${String(index + 1).padStart(2, "0")}`;
  return { id: `partner-${index + 1}`, name, logoPlaceholder: name, logoMediaId: "", replaceable: true };
});

const servePartners = async (page, content = defaultContent) => {
  await page.route("**/api/content", (route) => route.fulfill({
    json: { content, revision_id: "partner-qa", published_at: "2026-09-28T00:00:00Z" },
  }));
  await page.route("**/api/content/revision", (route) => route.fulfill({
    json: { revision_id: "partner-qa", published_at: "2026-09-28T00:00:00Z" },
  }));
};

const laneCoverage = (page) => page.locator("[data-partner-lane]").evaluateAll((lanes) => lanes.map((lane) => ({
  width: lane.getBoundingClientRect().width,
  groups: [...lane.querySelectorAll(".fa-partner-lane__group")].map((group) => group.getBoundingClientRect().width),
  direction: lane.dataset.direction,
  animation: getComputedStyle(lane.querySelector(".fa-partner-lane__track")).animationName,
})));

test("default partners fill both opposite moving lanes at 3840px", async ({ page }) => {
  await servePartners(page);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.setViewportSize({ width: 3840, height: 2160 });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const scene = page.getByTestId("partner-marquee");
  await expect(scene.locator("[data-partner-name]")).toHaveCount(26);
  await expect.poll(async () => (await laneCoverage(page)).every((lane) =>
    lane.groups.length === 2 && lane.groups.every((width) => width >= lane.width))).toBe(true);
  const lanes = await laneCoverage(page);
  expect(lanes.map((lane) => lane.direction)).toEqual(["right", "left"]);
  expect(lanes.map((lane) => lane.animation)).toEqual(["fa-partners-right", "fa-partners-left"]);
  await expect(scene.locator('[data-marquee-copy="true"][aria-hidden="true"]')).toHaveCount(2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
});

test("a short Admin list grows with the lane on resize without repeated spoken names", async ({ page }) => {
  const content = JSON.parse(JSON.stringify(seed));
  content.partners = ["A", "B", "C", "D"].map((name) => ({
    id: `brand-${name.toLowerCase()}`, name: `Brand ${name}`, logoMediaId: "", replaceable: false,
  }));
  await servePartners(page, content);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const scene = page.getByTestId("partner-marquee");
  await expect(scene.locator("[data-partner-name]")).toHaveCount(4);
  await page.setViewportSize({ width: 3840, height: 2160 });
  await expect.poll(async () => (await laneCoverage(page)).every((lane) =>
    lane.groups.length === 2 && lane.groups.every((width) => width >= lane.width))).toBe(true);
  await expect(scene.locator('[data-marquee-copy="false"]')).toHaveCount(2);
  await expect(scene.locator('[data-marquee-copy="false"] [data-partner-name]')).toHaveText(["Brand A", "Brand B", "Brand C", "Brand D"]);
  await expect(scene.locator('[data-marquee-copy="false"] [aria-hidden="true"]')).not.toHaveCount(0);
  await expect(scene.locator('[data-marquee-copy="true"]:not([aria-hidden="true"])')).toHaveCount(0);
});

test("two Admin partners keep both opposite lanes filled on a 3840px display", async ({ page }) => {
  const content = JSON.parse(JSON.stringify(seed));
  content.partners = ["A", "B"].map((name) => ({
    id: `brand-${name.toLowerCase()}`, name: `Brand ${name}`, logoMediaId: "", replaceable: false,
  }));
  await servePartners(page, content);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.setViewportSize({ width: 3840, height: 2160 });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const scene = page.getByTestId("partner-marquee");
  await expect(scene.locator("[data-partner-name]")).toHaveText(["Brand A", "Brand B"]);
  await expect.poll(async () => (await laneCoverage(page)).every((lane) =>
    lane.groups.length === 2 && lane.groups.every((width) => width >= lane.width))).toBe(true);
  expect((await laneCoverage(page)).map((lane) => lane.direction)).toEqual(["right", "left"]);
  await expect(scene.locator('[data-marquee-copy="true"][aria-hidden="true"]')).toHaveCount(2);
});

test("wide partner cards and logos remain readable", async ({ page }) => {
  await servePartners(page);
  await page.setViewportSize({ width: 2560, height: 1440 });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const dimensions = await page.getByTestId("partner-marquee").evaluate((scene) => ({
    card: scene.querySelector(".fa-partner").getBoundingClientRect().width,
    logo: scene.querySelector(".fa-partner__mark").getBoundingClientRect().width,
  }));
  expect(dimensions.card).toBeGreaterThanOrEqual(240);
  expect(dimensions.logo).toBeGreaterThanOrEqual(170);
});

test("reduced motion leaves the original partner lanes scrollable", async ({ page }) => {
  await servePartners(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const scene = page.getByTestId("partner-marquee");
  await expect(scene.locator("[data-partner-name]")).toHaveCount(26);
  await expect(scene.locator('[data-marquee-copy="true"]')).toHaveCount(0);
  const lanes = await scene.locator("[data-partner-lane]").evaluateAll((nodes) => nodes.map((lane) => ({
    motion: lane.dataset.motion,
    overflow: getComputedStyle(lane).overflowX,
    scrollable: lane.scrollWidth > lane.clientWidth,
  })));
  expect(lanes).toHaveLength(2);
  expect(lanes.every((lane) => lane.motion === "static" && lane.overflow === "auto" && lane.scrollable)).toBe(true);
});
