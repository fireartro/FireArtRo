const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const BASE_URL = process.env.FIREART_URL || "http://127.0.0.1:4173";
const CAPTURES = [
  { name: "desktop", width: 1440, height: 900, frameCount: 60 },
  { name: "mobile", width: 430, height: 932, frameCount: 48 },
];

const outputRoot = path.resolve(
  __dirname,
  "..",
  "..",
  "output",
  "implementation-motion-study",
  "fireart",
);

const waitForFrames = (page, count = 2) => page.evaluate((frameCount) =>
  new Promise((resolve) => {
    let remaining = frameCount;
    const next = () => {
      remaining -= 1;
      if (remaining <= 0) resolve();
      else requestAnimationFrame(next);
    };
    requestAnimationFrame(next);
  }), count);

async function captureViewport(browser, capture) {
  const outputDirectory = path.join(outputRoot, capture.name, "section-shutter");
  fs.rmSync(outputDirectory, { recursive: true, force: true });
  fs.mkdirSync(outputDirectory, { recursive: true });

  const context = await browser.newContext({
    viewport: { width: capture.width, height: capture.height },
    reducedMotion: "no-preference",
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
  await page.waitForSelector('[data-testid="section-shutter"]');

  const cookieButton = page.getByRole("button", { name: /doar necesare/i });
  if (await cookieButton.count()) await cookieButton.click();

  const range = await page.locator('[data-testid="section-shutter"]').evaluate((node) => ({
    top: node.getBoundingClientRect().top + window.scrollY,
    distance: Math.max(1, node.offsetHeight - window.innerHeight),
  }));

  const frames = [];
  for (let index = 0; index < capture.frameCount; index += 1) {
    const progress = index / (capture.frameCount - 1);
    const scrollY = Math.round(range.top + range.distance * progress);
    await page.evaluate((top) => window.scrollTo(0, top), scrollY);
    await waitForFrames(page);
    await page.waitForTimeout(38);

    const state = await page.locator('[data-testid="section-shutter"]').evaluate((node) => {
      const scales = [...node.querySelectorAll("[data-shutter-band]")].map((band) =>
        Number(new DOMMatrixReadOnly(getComputedStyle(band).transform).m22.toFixed(4)));
      const outgoing = node.querySelector(".fa-shutter__media--outgoing");
      const incoming = node.querySelector(".fa-shutter__media--incoming");
      return {
        scales,
        outgoingOpacity: outgoing ? Number(getComputedStyle(outgoing).opacity) : null,
        incomingOpacity: incoming ? Number(getComputedStyle(incoming).opacity) : null,
      };
    });

    const file = `frame-${String(index).padStart(2, "0")}.jpg`;
    await page.screenshot({ path: path.join(outputDirectory, file), type: "jpeg", quality: 84 });
    frames.push({ index, file, progress, scrollY, ...state });
  }

  fs.writeFileSync(path.join(outputDirectory, "frames.json"), JSON.stringify(frames, null, 2));
  await context.close();
  process.stdout.write(`${capture.name}: ${outputDirectory}\n`);
}

async function main() {
  const browser = await chromium.launch({
    headless: true,
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  });

  try {
    for (const capture of CAPTURES) {
      await captureViewport(browser, capture);
    }
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
