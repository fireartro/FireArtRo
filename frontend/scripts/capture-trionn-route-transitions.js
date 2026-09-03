const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const baseUrl = "https://trionn.com/";
const outputRoot = path.resolve(__dirname, "..", "..", "output", "reference-motion-study", "trionn", "route-transitions");
const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

const targets = [
  { slug: "home-to-work", href: "/work" },
  { slug: "home-to-services", href: "/services" },
  { slug: "home-to-about", href: "/about" },
  { slug: "home-to-contact", href: "/contact" },
];

function ensureDirectory(directory) {
  fs.mkdirSync(directory, { recursive: true });
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2));
}

async function waitForLoader(page) {
  await page.waitForLoadState("domcontentloaded");
  await page.waitForFunction(() => {
    const loader = document.querySelector(".pl-overlay");
    return document.readyState === "complete" && (!loader || !loader.classList.contains("active"));
  }, { timeout: 45_000 });
  await delay(1_200);
}

async function startDomSampling(page) {
  await page.evaluate(() => {
    window.__codexRouteTransition = [];
    const startedAt = performance.now();
    const summarize = (element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return {
        className: typeof element.className === "string" ? element.className : "",
        rect: {
          x: Math.round(rect.x),
          y: Math.round(rect.y),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        },
        display: style.display,
        visibility: style.visibility,
        opacity: Number.parseFloat(style.opacity) || 0,
        backgroundColor: style.backgroundColor,
        transform: style.transform,
        transformOrigin: style.transformOrigin,
        clipPath: style.clipPath,
      };
    };
    const sample = (now) => {
      window.__codexRouteTransition.push({
        elapsedMs: now - startedAt,
        url: location.href,
        bodyBackground: getComputedStyle(document.body).backgroundColor,
        overlays: [...document.querySelectorAll(
          ".pl-overlay, .pl-trans-overlay, .pl-belt, .pl-flying-plus, .pl-overlay-center, .pl-trans-center, .pl-logo-black-box, .pl-t-path, .pl-trans-label",
        )].map(summarize),
      });
      if (now - startedAt < 7_000) requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });
}

async function captureTarget(browser, target) {
  const directory = path.join(outputRoot, target.slug);
  ensureDirectory(directory);
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  const screencastFrames = [];
  let captureFrames = false;

  cdp.on("Page.screencastFrame", async ({ data, metadata, sessionId }) => {
    try {
      await cdp.send("Page.screencastFrameAck", { sessionId });
    } catch {
      // The page can swap renderers during a route transition.
    }
    if (captureFrames) {
      screencastFrames.push({ data, metadata, capturedAt: Date.now() });
    }
  });

  try {
    await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 120_000 });
    await waitForLoader(page);
    const visibleLink = page.locator(`a[href='${target.href}']:visible`).first();
    const hasVisibleLink = await visibleLink.count() > 0;
    const semanticLink = page.locator(`a[href='${target.href}']`).first();
    if (!hasVisibleLink && await semanticLink.count() === 0) throw new Error(`Link not found: ${target.href}`);

    await cdp.send("Page.startScreencast", {
      format: "jpeg",
      quality: 76,
      maxWidth: 1440,
      maxHeight: 900,
      everyNthFrame: 1,
    });
    await delay(250);
    screencastFrames.length = 0;
    captureFrames = true;
    await startDomSampling(page);
    const clickedAt = Date.now();
    if (hasVisibleLink) {
      await visibleLink.click({ noWaitAfter: true });
    } else {
      await page.evaluate((href) => document.querySelector(`a[href='${href}']`)?.click(), target.href);
    }

    const deadline = Date.now() + 9_000;
    while (Date.now() < deadline) {
      const reachedTarget = new URL(page.url()).pathname === target.href;
      const overlayActive = await page.evaluate(() => Boolean(
        document.querySelector(".pl-overlay.active, .pl-trans-overlay.active"),
      )).catch(() => true);
      if (reachedTarget && !overlayActive && screencastFrames.length >= 35) break;
      await delay(80);
    }
    captureFrames = false;
    await cdp.send("Page.stopScreencast").catch(() => {});
    await delay(250);

    const domSamples = await page.evaluate(() => window.__codexRouteTransition || []);
    const frameCount = Math.min(60, screencastFrames.length);
    const selected = [];
    for (let index = 0; index < frameCount; index += 1) {
      const sourceIndex = frameCount === 1
        ? 0
        : Math.round(index * (screencastFrames.length - 1) / (frameCount - 1));
      selected.push(screencastFrames[sourceIndex]);
    }
    selected.forEach((frame, index) => {
      fs.writeFileSync(path.join(directory, `frame-${String(index).padStart(2, "0")}.jpg`), Buffer.from(frame.data, "base64"));
    });
    writeJson(path.join(directory, "screencast-metadata.json"), selected.map((frame, index) => ({
      frame: index,
      timestamp: frame.metadata?.timestamp,
      pageScaleFactor: frame.metadata?.pageScaleFactor,
      scrollOffsetX: frame.metadata?.scrollOffsetX,
      scrollOffsetY: frame.metadata?.scrollOffsetY,
      capturedAfterClickMs: frame.capturedAt - clickedAt,
    })));
    writeJson(path.join(directory, "dom-frames.json"), domSamples);
    await page.screenshot({ path: path.join(directory, "final.jpg"), type: "jpeg", quality: 82 });
    const summary = {
      ...target,
      finalUrl: page.url(),
      routeChanged: new URL(page.url()).pathname === target.href,
      rawScreencastFrames: screencastFrames.length,
      savedFrames: selected.length,
      domSamples: domSamples.length,
      durationMs: Date.now() - clickedAt,
    };
    writeJson(path.join(directory, "summary.json"), summary);
    process.stdout.write(`${JSON.stringify(summary)}\n`);
  } finally {
    await context.close();
  }
}

async function main() {
  ensureDirectory(outputRoot);
  const requestedSlug = process.argv[2];
  const selectedTargets = requestedSlug
    ? targets.filter((target) => target.slug === requestedSlug)
    : targets;
  if (selectedTargets.length === 0) throw new Error(`Unknown transition: ${requestedSlug}`);
  const browser = await chromium.launch({
    executablePath: chromePath,
    headless: true,
    args: ["--disable-background-timer-throttling", "--disable-renderer-backgrounding"],
  });
  try {
    for (const target of selectedTargets) {
      await captureTarget(browser, target);
    }
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
});
