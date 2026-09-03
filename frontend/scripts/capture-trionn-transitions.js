const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const baseUrl = "https://trionn.com/";
const outputRoot = path.resolve(__dirname, "..", "..", "output", "reference-motion-study", "trionn", "transitions");
const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

const targets = [
  { slug: "home-to-work", href: "/work", text: "Work" },
  { slug: "home-to-services", href: "/services", text: "Services" },
  { slug: "home-to-about", href: "/about", text: "About" },
  { slug: "home-to-contact", href: "/contact", text: "Contact" },
];

function ensureDirectory(directory) {
  fs.mkdirSync(directory, { recursive: true });
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2));
}

async function getTransitionState(page, startedAt, index) {
  return page.evaluate(({ startedAt, index }) => {
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
        style: {
          display: style.display,
          visibility: style.visibility,
          opacity: style.opacity,
          backgroundColor: style.backgroundColor,
          transform: style.transform,
          transformOrigin: style.transformOrigin,
          clipPath: style.clipPath,
        },
      };
    };

    const overlayElements = [...document.querySelectorAll(
      ".pl-white-overlay, .pl-overlay, .pl-trans-overlay, .pl-belt, .pl-flying-plus, .pl-overlay-center, .pl-trans-center, .pl-logo-black-box, .pl-t-path",
    )].map(summarize);

    return {
      frame: index,
      elapsedMs: performance.now() - startedAt,
      url: location.href,
      bodyBackground: getComputedStyle(document.body).backgroundColor,
      bodyOpacity: getComputedStyle(document.body).opacity,
      overlays: overlayElements,
      animations: document.getAnimations().slice(0, 80).map((animation) => ({
        playState: animation.playState,
        currentTime: Number(animation.currentTime) || 0,
        playbackRate: animation.playbackRate,
        targetClass: animation.effect?.target?.className || "",
      })),
    };
  }, { startedAt, index });
}

async function captureFrames(page, directory, startedAt, frameCount = 60) {
  const states = [];
  for (let index = 0; index < frameCount; index += 1) {
    states.push(await getTransitionState(page, startedAt, index));
    await page.screenshot({
      path: path.join(directory, `frame-${String(index).padStart(2, "0")}.jpg`),
      type: "jpeg",
      quality: 72,
      animations: "allow",
    });
    await delay(24);
  }
  writeJson(path.join(directory, "frames.json"), states);
  return states;
}

async function captureInitialLoad(browser) {
  const directory = path.join(outputRoot, "initial-load");
  ensureDirectory(directory);
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const startedAt = await page.evaluate(() => performance.now());
  await page.goto(baseUrl, { waitUntil: "commit", timeout: 120_000 });
  const states = await captureFrames(page, directory, startedAt, 60);
  await page.waitForLoadState("domcontentloaded");
  await delay(2_500);
  await page.screenshot({ path: path.join(directory, "final.jpg"), type: "jpeg", quality: 80 });
  writeJson(path.join(directory, "summary.json"), {
    type: "initial-load",
    frameCount: states.length,
    finalUrl: page.url(),
  });
  await context.close();
  process.stdout.write("CAPTURED initial load transition (60 frames)\n");
}

async function captureRouteTransition(browser, target) {
  const directory = path.join(outputRoot, target.slug);
  ensureDirectory(directory);
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 120_000 });
  await delay(5_500);
  const links = await page.evaluate(() => [...document.querySelectorAll("a[href]")]
    .map((link) => ({ href: link.getAttribute("href"), text: (link.textContent || "").replace(/\s+/g, " ").trim(), visible: Boolean(link.offsetWidth || link.offsetHeight) }))
    .filter((link) => link.visible));
  writeJson(path.join(directory, "visible-links.json"), links);

  const clicked = await page.evaluate(({ href, text }) => {
    const link = [...document.querySelectorAll("a[href]")].find((candidate) => {
      const candidateHref = candidate.getAttribute("href") || "";
      const candidateText = (candidate.textContent || "").replace(/\s+/g, " ").trim();
      return (candidateHref === href || candidateHref.endsWith(href)) && candidateText.toLowerCase().includes(text.toLowerCase()) && Boolean(candidate.offsetWidth || candidate.offsetHeight);
    });
    if (!link) return false;
    link.click();
    return true;
  }, target);
  if (!clicked) throw new Error(`Could not find visible ${target.text} link (${target.href})`);

  const startedAt = await page.evaluate(() => performance.now());
  const states = await captureFrames(page, directory, startedAt, 60);
  await delay(2_000);
  await page.screenshot({ path: path.join(directory, "final.jpg"), type: "jpeg", quality: 80 });
  writeJson(path.join(directory, "summary.json"), {
    ...target,
    frameCount: states.length,
    firstUrl: states[0]?.url,
    finalUrl: page.url(),
    overlayClasses: [...new Set(states.flatMap((state) => state.overlays.map((overlay) => overlay.className)))],
  });
  await context.close();
  process.stdout.write(`CAPTURED ${target.slug} (60 frames)\n`);
}

async function main() {
  ensureDirectory(outputRoot);
  const browser = await chromium.launch({
    executablePath: chromePath,
    headless: true,
    args: ["--disable-background-timer-throttling", "--disable-renderer-backgrounding"],
  });
  try {
    await captureInitialLoad(browser);
    for (const target of targets) {
      await captureRouteTransition(browser, target);
    }
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
});
