const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const baseUrl = "https://trionn.com/";
const outputRoot = path.resolve(
  __dirname,
  "..",
  "..",
  "output",
  "playwright",
  "trionn-detailed-transitions",
);
const frameCount = 60;

const routeTargets = [
  { slug: "01-route-home-to-about", href: "/about" },
  { slug: "02-route-home-to-work", href: "/work" },
  { slug: "03-route-home-to-services", href: "/services" },
];

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function ensureCleanDirectory(directory) {
  fs.rmSync(directory, { recursive: true, force: true });
  fs.mkdirSync(directory, { recursive: true });
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2));
}

async function waitForTrionn(page) {
  await page.waitForLoadState("domcontentloaded");
  await page.waitForFunction(() => {
    const loader = document.querySelector(".pl-overlay");
    return document.readyState === "complete" && (!loader || !loader.classList.contains("active"));
  }, { timeout: 60_000 });
  await delay(1_500);
}

async function collectPageState(page, extra = {}) {
  return page.evaluate((extraState) => {
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
        opacity: Number.parseFloat(style.opacity) || 0,
        backgroundColor: style.backgroundColor,
        transform: style.transform,
        transformOrigin: style.transformOrigin,
      };
    };

    const possibleBands = [...document.querySelectorAll("body *")]
      .filter((element) => {
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        const isHorizontalBand = rect.width > innerWidth * 0.7 && rect.height > 1 && rect.height < innerHeight * 0.35;
        const isDarkOrLight = ["rgb(4, 5, 8)", "rgb(255, 255, 255)", "rgb(12, 12, 12)"].includes(style.backgroundColor);
        const isAnimated = style.transform !== "none" || style.willChange.includes("transform");
        return isHorizontalBand && isDarkOrLight && isAnimated;
      })
      .slice(0, 20)
      .map(summarize);

    const routeOverlays = [...document.querySelectorAll(
      ".pl-overlay, .pl-trans-overlay, .pl-belt, .pl-flying-plus, .pl-overlay-center, .pl-trans-center, .pl-logo-black-box, .pl-t-path, .pl-trans-label",
    )].map(summarize);

    return {
      ...extraState,
      url: location.href,
      scrollY: Math.round(scrollY),
      bodyBackground: getComputedStyle(document.body).backgroundColor,
      possibleBands,
      routeOverlays,
    };
  }, extra);
}

async function captureScrollTransition(browser) {
  const slug = "01-scroll-manifesto-to-key-facts";
  const directory = path.join(outputRoot, slug);
  ensureCleanDirectory(directory);
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    reducedMotion: "no-preference",
  });
  const page = await context.newPage();

  try {
    await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 120_000 });
    await waitForTrionn(page);
    const factsTop = await page.evaluate(() => {
      const heading = [...document.querySelectorAll("h1, h2, h3, p, div")]
        .find((element) => (element.textContent || "").trim() === "Key facts");
      if (!heading) return 2700;
      let section = heading.closest("section") || heading.parentElement;
      while (section?.parentElement && section.getBoundingClientRect().height < innerHeight * 0.8) {
        section = section.parentElement;
      }
      return Math.round((section || heading).getBoundingClientRect().top + scrollY);
    });
    // The pinned manifesto uses transformed layout coordinates, so its visual
    // transition does not line up with the later section's document-flow top.
    const start = 2320;
    const end = 3020;
    const states = [];

    for (let index = 0; index < frameCount; index += 1) {
      const progress = index / (frameCount - 1);
      const requestedScrollY = Math.round(start + (end - start) * progress);
      await page.evaluate((y) => {
        const gsap = window.gsap;
        const scrollTrigger = window.ScrollTrigger || gsap?.core?.globals?.().ScrollTrigger;
        const lenis = window.lenis || window.__lenis || window.lenisInstance;
        lenis?.scrollTo?.(y, { immediate: true, force: true });
        window.scrollTo(0, y);
        scrollTrigger?.update?.();
      }, requestedScrollY);
      await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      await delay(90);
      states.push(await collectPageState(page, { frame: index, progress, requestedScrollY }));
      await page.screenshot({
        path: path.join(directory, `frame-${String(index + 1).padStart(2, "0")}.jpg`),
        type: "jpeg",
        quality: 92,
        animations: "allow",
      });
    }

    writeJson(path.join(directory, "frames.json"), states);
    writeJson(path.join(directory, "summary.json"), {
      slug,
      type: "scroll-section-transition",
      source: baseUrl,
      viewport: { width: 1440, height: 900 },
      frameCount,
      factsTop,
      start,
      end,
      capturedAt: new Date().toISOString(),
    });
    process.stdout.write(`CAPTURED ${slug}: ${frameCount} frames from y=${start} to y=${end}\n`);
  } finally {
    await context.close();
  }
}

async function captureRouteTransition(browser, target) {
  const directory = path.join(outputRoot, target.slug);
  ensureCleanDirectory(directory);
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    reducedMotion: "no-preference",
  });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  const rawFrames = [];
  let captureFrames = false;

  cdp.on("Page.screencastFrame", async ({ data, metadata, sessionId }) => {
    try {
      await cdp.send("Page.screencastFrameAck", { sessionId });
    } catch {
      // Route navigation can replace the renderer between acknowledgement and capture.
    }
    if (captureFrames) rawFrames.push({ data, metadata, capturedAt: Date.now() });
  });

  try {
    await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 120_000 });
    await waitForTrionn(page);
    const targetLink = page.locator(`a[href='${target.href}']:visible`).first();
    const semanticLink = page.locator(`a[href='${target.href}']`).first();
    const hasVisibleLink = await targetLink.count() > 0;
    if (!hasVisibleLink && await semanticLink.count() === 0) {
      throw new Error(`Trionn link not found: ${target.href}`);
    }

    await cdp.send("Page.startScreencast", {
      format: "jpeg",
      quality: 92,
      maxWidth: 1440,
      maxHeight: 900,
      everyNthFrame: 1,
    });
    await delay(200);
    rawFrames.length = 0;
    captureFrames = true;
    const clickedAt = Date.now();
    if (hasVisibleLink) {
      await targetLink.click({ noWaitAfter: true });
    } else {
      await page.evaluate((href) => document.querySelector(`a[href='${href}']`)?.click(), target.href);
    }

    const deadline = clickedAt + 7_000;
    while (Date.now() < deadline) {
      const routeReached = new URL(page.url()).pathname === target.href;
      const overlayActive = await page.evaluate(() => Boolean(
        document.querySelector(".pl-overlay.active, .pl-trans-overlay.active"),
      )).catch(() => true);
      if (routeReached && !overlayActive && rawFrames.length >= 80 && Date.now() - clickedAt > 2_800) break;
      await delay(50);
    }
    captureFrames = false;
    await cdp.send("Page.stopScreencast").catch(() => {});

    if (rawFrames.length < frameCount) {
      throw new Error(`${target.slug} produced only ${rawFrames.length} screencast frames`);
    }

    const selected = Array.from({ length: frameCount }, (_, index) => {
      const sourceIndex = Math.round(index * (rawFrames.length - 1) / (frameCount - 1));
      return { ...rawFrames[sourceIndex], sourceIndex };
    });
    selected.forEach((frame, index) => {
      fs.writeFileSync(
        path.join(directory, `frame-${String(index + 1).padStart(2, "0")}.jpg`),
        Buffer.from(frame.data, "base64"),
      );
    });
    const states = [];
    for (let index = 0; index < frameCount; index += 1) {
      const frame = selected[index];
      states.push({
        frame: index,
        sourceIndex: frame.sourceIndex,
        capturedAfterClickMs: frame.capturedAt - clickedAt,
        timestamp: frame.metadata?.timestamp,
        scrollOffsetX: frame.metadata?.scrollOffsetX,
        scrollOffsetY: frame.metadata?.scrollOffsetY,
      });
    }
    writeJson(path.join(directory, "frames.json"), states);
    writeJson(path.join(directory, "summary.json"), {
      ...target,
      type: "route-transition",
      source: baseUrl,
      viewport: { width: 1440, height: 900 },
      rawFrameCount: rawFrames.length,
      frameCount,
      finalUrl: page.url(),
      capturedAt: new Date().toISOString(),
    });
    process.stdout.write(`CAPTURED ${target.slug}: ${frameCount}/${rawFrames.length} frames\n`);
  } finally {
    await context.close();
  }
}

async function main() {
  fs.mkdirSync(outputRoot, { recursive: true });
  const requestedSlug = process.argv[2];
  const browser = await chromium.launch({
    executablePath: chromePath,
    headless: true,
    args: [
      "--disable-background-timer-throttling",
      "--disable-renderer-backgrounding",
      "--hide-scrollbars",
    ],
  });

  try {
    if (requestedSlug === "01-scroll-manifesto-to-key-facts") {
      await captureScrollTransition(browser);
    }
    const selectedRoutes = requestedSlug
      ? routeTargets.filter((target) => target.slug === requestedSlug)
      : routeTargets;
    if (requestedSlug && requestedSlug !== "01-scroll-manifesto-to-key-facts" && selectedRoutes.length === 0) {
      throw new Error(`Unknown transition slug: ${requestedSlug}`);
    }
    for (const target of selectedRoutes) await captureRouteTransition(browser, target);
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
});
