const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const outputRoot = path.resolve(__dirname, "..", "..", "output", "chrome-research-v2");
const references = [
  ["trionn", "https://trionn.com/"],
  ["lumasky", "https://www.lumasky.org/"],
  ["skymagic", "https://skymagic.show/"],
  ["flightshows", "https://flightshows.com/"],
  ["arteventia", "https://www.arteventia.fr/en/"],
];

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function captureFrames(page, directory, prefix, count) {
  const metrics = await page.evaluate(() => ({
    height: document.documentElement.scrollHeight,
    viewport: window.innerHeight,
  }));
  const travel = Math.max(0, metrics.height - metrics.viewport);

  for (let index = 0; index < count; index += 1) {
    const progress = count === 1 ? 0 : index / (count - 1);
    await page.evaluate((top) => window.scrollTo({ top, behavior: "instant" }), travel * progress);
    await delay(300);
    await page.screenshot({
      path: path.join(directory, `${prefix}-${String(index).padStart(2, "0")}.jpg`),
      type: "jpeg",
      quality: 72,
      animations: "allow",
    });
  }
}

async function inspectPage(page, cdp, styleSheets) {
  const dom = await cdp.send("DOM.getDocument", { depth: 2, pierce: true });
  const queried = await cdp.send("DOM.querySelectorAll", {
    nodeId: dom.root.nodeId,
    selector: "h1, h2, main section, button, a[href], canvas",
  });
  const computedSamples = [];

  for (const nodeId of queried.nodeIds.slice(0, 40)) {
    try {
      const description = await cdp.send("DOM.describeNode", { nodeId });
      const styles = await cdp.send("CSS.getComputedStyleForNode", { nodeId });
      const selected = Object.fromEntries(
        styles.computedStyle
          .filter(({ name }) => [
            "background-color", "background-image", "border-radius", "clip-path", "color",
            "display", "font-family", "font-size", "font-weight", "grid-template-columns",
            "height", "line-height", "overflow", "position", "transform", "width",
          ].includes(name))
          .map(({ name, value }) => [name, value]),
      );
      computedSamples.push({
        nodeName: description.node.nodeName,
        attributes: description.node.attributes,
        styles: selected,
      });
    } catch {
      // Dynamic nodes can detach during animated reference-site transitions.
    }
  }

  const pageReport = await page.evaluate(() => {
    const summarize = (element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return {
        tag: element.tagName.toLowerCase(),
        className: typeof element.className === "string" ? element.className.slice(0, 180) : "",
        text: (element.textContent || "").replace(/\s+/g, " ").trim().slice(0, 180),
        rect: {
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          left: Math.round(rect.left),
          top: Math.round(rect.top + window.scrollY),
        },
        style: {
          backgroundColor: style.backgroundColor,
          backgroundImage: style.backgroundImage.slice(0, 220),
          borderRadius: style.borderRadius,
          clipPath: style.clipPath,
          color: style.color,
          display: style.display,
          fontFamily: style.fontFamily,
          fontSize: style.fontSize,
          fontWeight: style.fontWeight,
          gridTemplateColumns: style.gridTemplateColumns,
          letterSpacing: style.letterSpacing,
          lineHeight: style.lineHeight,
          position: style.position,
        },
      };
    };

    const scriptSources = [...document.scripts].map((script) => script.src).filter(Boolean);
    const resources = performance.getEntriesByType("resource").map((entry) => entry.name);
    const libraryText = [...scriptSources, ...resources].join(" ").toLowerCase();
    const buttons = [...document.querySelectorAll("button, a[href]")]
      .filter((element) => element.getBoundingClientRect().width > 0)
      .slice(0, 30)
      .map(summarize);

    return {
      title: document.title,
      url: location.href,
      viewport: { width: innerWidth, height: innerHeight },
      document: {
        width: document.documentElement.scrollWidth,
        height: document.documentElement.scrollHeight,
      },
      body: summarize(document.body),
      headings: [...document.querySelectorAll("h1, h2, h3")].slice(0, 30).map(summarize),
      sections: [...document.querySelectorAll("main section, main > div, body > section")].slice(0, 40).map(summarize),
      controls: buttons,
      fixedOrSticky: [...document.querySelectorAll("body *")]
        .filter((element) => ["fixed", "sticky"].includes(getComputedStyle(element).position))
        .slice(0, 25)
        .map(summarize),
      canvasCount: document.querySelectorAll("canvas").length,
      videoCount: document.querySelectorAll("video").length,
      imageCount: document.images.length,
      animationCount: document.getAnimations().length,
      detectedLibraries: {
        gsap: Boolean(window.gsap) || libraryText.includes("gsap"),
        lenis: Boolean(window.lenis) || libraryText.includes("lenis"),
        locomotive: libraryText.includes("locomotive"),
        three: Boolean(window.THREE) || libraryText.includes("three"),
        barba: Boolean(window.barba) || libraryText.includes("barba"),
        webflow: Boolean(window.Webflow) || libraryText.includes("webflow"),
      },
      scriptSources,
    };
  });

  return {
    ...pageReport,
    devtools: {
      styleSheets: styleSheets.filter(Boolean).slice(0, 120),
      computedSamples,
    },
  };
}

async function auditReference(browser, slug, url) {
  const directory = path.join(outputRoot, slug);
  fs.mkdirSync(directory, { recursive: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  const styleSheets = [];
  await cdp.send("DOM.enable");
  await cdp.send("CSS.enable");
  cdp.on("CSS.styleSheetAdded", ({ header }) => styleSheets.push(header.sourceURL || header.origin));

  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await delay(5_000);
  await captureFrames(page, directory, "desktop", 24);
  const desktop = await inspectPage(page, cdp, styleSheets);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await delay(1_000);
  await captureFrames(page, directory, "mobile", 12);
  const mobile = await page.evaluate(() => ({
    width: document.documentElement.scrollWidth,
    height: document.documentElement.scrollHeight,
    viewport: { width: innerWidth, height: innerHeight },
  }));

  const report = { slug, source: url, desktop, mobile };
  fs.writeFileSync(path.join(directory, "devtools-report.json"), JSON.stringify(report, null, 2));
  await context.close();
  return report;
}

async function main() {
  fs.mkdirSync(outputRoot, { recursive: true });
  const browser = await chromium.launch({ executablePath: chromePath, headless: true });
  const summary = [];

  try {
    for (const [slug, url] of references) {
      try {
        const report = await auditReference(browser, slug, url);
        summary.push({
          slug,
          url: report.desktop.url,
          height: report.desktop.document.height,
          sections: report.desktop.sections.length,
          canvas: report.desktop.canvasCount,
          videos: report.desktop.videoCount,
          animations: report.desktop.animationCount,
          libraries: report.desktop.detectedLibraries,
        });
        process.stdout.write(`AUDITED ${slug}\n`);
      } catch (error) {
        summary.push({ slug, error: error.message });
        process.stderr.write(`FAILED ${slug}: ${error.message}\n`);
      }
    }
  } finally {
    await browser.close();
  }

  fs.writeFileSync(path.join(outputRoot, "summary.json"), JSON.stringify(summary, null, 2));
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
});
