const { chromium } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

const baseUrl = process.env.BASE_URL || "http://127.0.0.1:4173";
const frameCount = Number(process.env.FRAME_COUNT || 60);
const outputRoot = path.resolve(__dirname, "../output/motion-study");

function ensureDirectory(directory) {
  fs.mkdirSync(directory, { recursive: true });
}

async function settle(page, milliseconds = 58) {
  await page.waitForTimeout(milliseconds);
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

async function captureScrollScene(page, sceneName, nextSceneName) {
  const directory = path.join(outputRoot, sceneName);
  ensureDirectory(directory);
  const range = await page.evaluate(({ sceneName: current, nextSceneName: next }) => {
    const scene = document.querySelector(`[data-home-scene="${current}"]`);
    const following = next ? document.querySelector(`[data-home-scene="${next}"]`) : null;
    const top = scene.getBoundingClientRect().top + window.scrollY;
    const bottom = following
      ? following.getBoundingClientRect().top + window.scrollY
      : top + scene.getBoundingClientRect().height;
    return {
      start: Math.max(0, top),
      end: Math.max(top, bottom - window.innerHeight),
    };
  }, { sceneName, nextSceneName });

  for (let index = 0; index < frameCount; index += 1) {
    const progress = index / (frameCount - 1);
    const scrollY = range.start + (range.end - range.start) * progress;
    await page.evaluate((position) => window.scrollTo(0, position), scrollY);
    await settle(page);
    await page.screenshot({
      path: path.join(directory, `frame-${String(index).padStart(2, "0")}.jpg`),
      type: "jpeg",
      quality: 76,
      animations: "allow",
    });
  }

  return { scene: sceneName, ...range, frames: frameCount };
}

async function captureInteraction(page, name, selector, duration = 720) {
  const directory = path.join(outputRoot, name);
  ensureDirectory(directory);
  const element = page.locator(selector).first();
  await element.scrollIntoViewIfNeeded();
  await settle(page, 120);

  const box = await element.boundingBox();
  if (!box) throw new Error(`Could not measure ${selector}`);
  await page.mouse.move(Math.max(2, box.x - 16), Math.max(2, box.y - 16));
  await page.screenshot({
    path: path.join(directory, "frame-00.jpg"),
    type: "jpeg",
    quality: 76,
  });
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);

  const delay = duration / (frameCount - 1);
  for (let index = 1; index < frameCount; index += 1) {
    await page.waitForTimeout(delay);
    await page.screenshot({
      path: path.join(directory, `frame-${String(index).padStart(2, "0")}.jpg`),
      type: "jpeg",
      quality: 76,
      animations: "allow",
    });
  }

  return { scene: name, selector, frames: frameCount, duration };
}

(async () => {
  ensureDirectory(outputRoot);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 1,
    colorScheme: "dark",
    reducedMotion: "no-preference",
  });
  const page = await context.newPage();
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  const necessaryCookies = page.getByRole("button", { name: /Doar necesare/i });
  if (await necessaryCookies.isVisible().catch(() => false)) {
    await necessaryCookies.click();
  }
  await settle(page, 250);

  const studies = [];
  studies.push(await captureScrollScene(page, "gallery", "packages"));
  studies.push(await captureScrollScene(page, "packages", "team"));
  studies.push(await captureInteraction(page, "team-hover", "[data-team-person]", 760));
  studies.push(await captureScrollScene(page, "partners", "brief"));
  studies.push(await captureInteraction(page, "brief-button", ".fa-brief__link", 560));

  fs.writeFileSync(path.join(outputRoot, "states.json"), JSON.stringify({ baseUrl, studies }, null, 2));
  await browser.close();
  process.stdout.write(`${JSON.stringify({ outputRoot, studies }, null, 2)}\n`);
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
