const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const { chromium } = require("playwright");

const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const outputRoot = path.resolve(__dirname, "..", "..", "output", "reference-motion-study");
const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

const references = {
  trionn: {
    url: "https://trionn.com/",
    desktopFrames: 45,
    mobileFrames: 32,
  },
};

function ensureDirectory(directory) {
  fs.mkdirSync(directory, { recursive: true });
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2));
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

async function waitForVisualIdle(page, milliseconds = 160) {
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await delay(milliseconds);
}

async function setScroll(page, top) {
  await page.evaluate((nextTop) => {
    const gsap = window.gsap;
    const scrollTrigger = window.ScrollTrigger || gsap?.core?.globals?.().ScrollTrigger;
    const lenis = window.lenis || window.__lenis || window.lenisInstance;

    if (lenis?.scrollTo) {
      lenis.scrollTo(nextTop, { immediate: true, force: true });
    }
    window.scrollTo(0, nextTop);
    scrollTrigger?.update?.();
  }, Math.max(0, Math.round(top)));
}

async function collectLandmarks(page) {
  return page.evaluate(() => {
    const clean = (value) => (value || "").replace(/\s+/g, " ").trim();
    const describe = (element) => {
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return {
        tag: element.tagName.toLowerCase(),
        className: typeof element.className === "string" ? element.className.slice(0, 240) : "",
        text: clean(element.textContent).slice(0, 220),
        top: Math.round(rect.top + scrollY),
        height: Math.round(rect.height),
        width: Math.round(rect.width),
        position: style.position,
        overflow: style.overflow,
      };
    };
    const findByText = (selector, phrase) => {
      const matches = [...document.querySelectorAll(selector)].filter((element) =>
        clean(element.textContent).toLowerCase().includes(phrase.toLowerCase()),
      );
      return matches
        .map(describe)
        .filter(Boolean)
        .sort((a, b) => a.height - b.height)[0] || null;
    };
    const gsap = window.gsap;
    const ScrollTrigger = window.ScrollTrigger || gsap?.core?.globals?.().ScrollTrigger;
    const triggers = ScrollTrigger?.getAll?.().map((trigger, index) => ({
      index,
      id: trigger.vars?.id || "",
      start: Math.round(Number(trigger.start) || 0),
      end: Math.round(Number(trigger.end) || 0),
      scrub: Boolean(trigger.vars?.scrub),
      pin: describe(trigger.pin),
      trigger: describe(trigger.trigger),
    })) || [];

    const candidates = [...document.querySelectorAll(
      "main section, main > div, [data-scroll-section], .pin-spacer, section, canvas, video",
    )]
      .map(describe)
      .filter((item) => item && item.height >= innerHeight * 0.45 && item.width >= innerWidth * 0.5)
      .sort((a, b) => a.top - b.top || b.height - a.height);

    return {
      viewport: { width: innerWidth, height: innerHeight },
      documentHeight: document.documentElement.scrollHeight,
      scrollHeight: Math.max(0, document.documentElement.scrollHeight - innerHeight),
      semantic: {
        hero: findByText("main section, main > div", "Designed to"),
        about: describe(document.querySelector(".home-about")) || findByText("section", "Trionn is an independent"),
        facts: findByText("section, main > div", "Key facts"),
        work: findByText(".pin-spacer, section, main > div", "Selected work & explorations"),
        stories: findByText("section, main > div", "Client stories"),
        playground: findByText(".pin-spacer, section, main > div", "Design in"),
      },
      candidates,
      triggers,
      globals: Object.keys(window).filter((key) => /gsap|scrolltrigger|lenis|three/i.test(key)).slice(0, 60),
    };
  });
}

function buildTrionnRanges(landmarks) {
  const { scrollHeight } = landmarks;
  const semantic = landmarks.semantic;
  const clamp = (value) => Math.max(0, Math.min(scrollHeight, Math.round(value)));
  const top = (item, fallback) => item?.top ?? fallback;
  const height = (item, fallback) => Math.max(1, item?.height ?? fallback);

  const aboutTop = top(semantic.about, scrollHeight * 0.04);
  const factsTop = top(semantic.facts, scrollHeight * 0.15);
  const workTop = top(semantic.work, scrollHeight * 0.19);
  const workHeight = height(semantic.work, scrollHeight * 0.52);
  const storiesTop = top(semantic.stories, workTop + workHeight * 0.92);
  const playgroundTop = top(semantic.playground, scrollHeight * 0.73);
  const workEnd = Math.min(storiesTop + innerFallback(landmarks.viewport.height), workTop + workHeight);
  const workSpan = Math.max(1, workEnd - workTop);

  return [
    { slug: "01-hero-symbol", label: "Hero symbol, headline, and blast prompt", start: 0, end: clamp(Math.max(aboutTop, landmarks.viewport.height)) },
    { slug: "02-manifesto", label: "Pinned manifesto and word reveal", start: clamp(aboutTop * 0.82), end: clamp(factsTop) },
    { slug: "03-key-facts", label: "Impact transition and key facts", start: clamp(factsTop * 0.98), end: clamp(workTop) },
    { slug: "04-work-entry", label: "Selected work entry and first project transition", start: clamp(workTop), end: clamp(workTop + workSpan * 0.27) },
    { slug: "05-work-middle-a", label: "Selected work media sequence A", start: clamp(workTop + workSpan * 0.23), end: clamp(workTop + workSpan * 0.51) },
    { slug: "06-work-middle-b", label: "Selected work media sequence B", start: clamp(workTop + workSpan * 0.47), end: clamp(workTop + workSpan * 0.76) },
    { slug: "07-work-exit", label: "Selected work final project and exit", start: clamp(workTop + workSpan * 0.72), end: clamp(Math.max(storiesTop, workTop + workSpan)) },
    { slug: "08-client-stories", label: "Client stories horizontal transition", start: clamp(storiesTop - landmarks.viewport.height * 0.25), end: clamp(playgroundTop) },
    { slug: "09-playground-footer", label: "Design playground, gallery scatter, and footer", start: clamp(playgroundTop), end: clamp(scrollHeight) },
  ].filter((range) => range.end - range.start >= 200);
}

function innerFallback(viewportHeight) {
  return Math.max(720, viewportHeight || 900);
}

async function collectSectionState(page, range, index, count) {
  return page.evaluate(({ range, index, count }) => {
    const viewportCenter = innerHeight * 0.5;
    const clean = (value) => (value || "").replace(/\s+/g, " ").trim();
    const summarize = (element) => {
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return {
        tag: element.tagName.toLowerCase(),
        className: typeof element.className === "string" ? element.className.slice(0, 180) : "",
        text: clean(element.textContent).slice(0, 160),
        rect: {
          x: Math.round(rect.x),
          y: Math.round(rect.y),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        },
        style: {
          color: style.color,
          backgroundColor: style.backgroundColor,
          fontFamily: style.fontFamily,
          fontSize: style.fontSize,
          lineHeight: style.lineHeight,
          opacity: style.opacity,
          position: style.position,
          transform: style.transform,
          clipPath: style.clipPath,
          mixBlendMode: style.mixBlendMode,
        },
      };
    };

    const visible = [...document.querySelectorAll("h1, h2, h3, p, a, button, canvas, video, img")]
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        return rect.bottom > 0 && rect.top < innerHeight && rect.width > 20 && rect.height > 8;
      });
    const nearest = visible
      .map((element) => ({ element, distance: Math.abs(element.getBoundingClientRect().top + element.getBoundingClientRect().height / 2 - viewportCenter) }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 12)
      .map(({ element }) => summarize(element));

    const animated = document.getAnimations()
      .filter((animation) => animation.playState !== "idle")
      .slice(0, 40)
      .map((animation) => ({
        playState: animation.playState,
        currentTime: Number(animation.currentTime) || 0,
        playbackRate: animation.playbackRate,
        target: summarize(animation.effect?.target),
      }));

    return {
      section: range.slug,
      frame: index,
      frameCount: count,
      progress: count <= 1 ? 0 : index / (count - 1),
      scrollY: Math.round(scrollY),
      nearest,
      animated,
      canvas: [...document.querySelectorAll("canvas")].map(summarize),
      videos: [...document.querySelectorAll("video")].map((video) => ({
        ...summarize(video),
        currentTime: video.currentTime,
        duration: video.duration,
        paused: video.paused,
        readyState: video.readyState,
      })),
    };
  }, { range, index, count });
}

async function collectMatchedStyles(page, cdp, sectionDirectory) {
  const auditElements = await page.evaluate(() => {
    const visible = [...document.querySelectorAll("h1, h2, h3, a, button, canvas, video, img, [class*='sticky']")]
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        return rect.bottom > 0 && rect.top < innerHeight && rect.width > 24 && rect.height > 12;
      })
      .sort((a, b) => b.getBoundingClientRect().width * b.getBoundingClientRect().height - a.getBoundingClientRect().width * a.getBoundingClientRect().height)
      .slice(0, 10);
    return auditElementsWithIds(visible);

    function auditElementsWithIds(elements) {
      return elements.map((element, index) => {
        const value = `codex-${Date.now()}-${index}`;
        element.setAttribute("data-codex-audit", value);
        return { value, tag: element.tagName.toLowerCase(), text: (element.textContent || "").replace(/\s+/g, " ").trim().slice(0, 120) };
      });
    }
  });
  const documentNode = await cdp.send("DOM.getDocument", { depth: 1, pierce: true });
  const report = [];

  for (const item of auditElements) {
    try {
      const queried = await cdp.send("DOM.querySelector", {
        nodeId: documentNode.root.nodeId,
        selector: `[data-codex-audit='${item.value}']`,
      });
      if (!queried.nodeId) continue;
      const matched = await cdp.send("CSS.getMatchedStylesForNode", { nodeId: queried.nodeId });
      const computed = await cdp.send("CSS.getComputedStyleForNode", { nodeId: queried.nodeId });
      report.push({
        ...item,
        computed: Object.fromEntries(computed.computedStyle
          .filter(({ name }) => ["color", "background-color", "font-family", "font-size", "font-weight", "line-height", "opacity", "position", "transform", "clip-path", "mix-blend-mode"].includes(name))
          .map(({ name, value }) => [name, value])),
        rules: (matched.matchedCSSRules || []).slice(-16).map(({ rule }) => ({
          selector: rule.selectorList?.text || "",
          origin: rule.origin,
          styleSheetId: rule.styleSheetId,
          range: rule.style?.range,
          declarations: (rule.style?.cssProperties || [])
            .filter((property) => property.name && property.value && !property.disabled)
            .slice(0, 30)
            .map(({ name, value, important }) => ({ name, value, important })),
        })),
      });
    } catch (error) {
      report.push({ ...item, error: error.message });
    }
  }
  writeJson(path.join(sectionDirectory, "matched-styles.json"), report);
}

async function captureRange(page, cdp, siteDirectory, range, frameCount, viewportLabel) {
  const sectionDirectory = path.join(siteDirectory, viewportLabel, range.slug);
  ensureDirectory(sectionDirectory);
  const states = [];
  const beforeMetrics = await cdp.send("Performance.getMetrics");
  await page.evaluate(() => { window.__codexLongTasks = []; });

  for (let index = 0; index < frameCount; index += 1) {
    const progress = frameCount <= 1 ? 0 : index / (frameCount - 1);
    const top = range.start + (range.end - range.start) * progress;
    await setScroll(page, top);
    await waitForVisualIdle(page, 110);
    const state = await collectSectionState(page, range, index, frameCount);
    states.push(state);
    await page.screenshot({
      path: path.join(sectionDirectory, `frame-${String(index).padStart(2, "0")}.jpg`),
      type: "jpeg",
      quality: 70,
      animations: "allow",
    });
  }

  await setScroll(page, range.start + (range.end - range.start) * 0.5);
  await waitForVisualIdle(page, 180);
  await collectMatchedStyles(page, cdp, sectionDirectory);
  const afterMetrics = await cdp.send("Performance.getMetrics");
  const longTasks = await page.evaluate(() => window.__codexLongTasks || []);
  writeJson(path.join(sectionDirectory, "frames.json"), states);
  writeJson(path.join(sectionDirectory, "performance.json"), {
    range,
    viewport: viewportLabel,
    beforeMetrics: beforeMetrics.metrics,
    afterMetrics: afterMetrics.metrics,
    longTasks,
  });
  process.stdout.write(`CAPTURED ${viewportLabel} ${range.slug} (${frameCount} frames)\n`);
}

async function captureInteractionSequence(page, siteDirectory) {
  const directory = path.join(siteDirectory, "desktop", "10-hero-hold-interaction");
  ensureDirectory(directory);
  await setScroll(page, 0);
  await waitForVisualIdle(page, 500);
  const center = { x: Math.round((await page.viewportSize()).width * 0.5), y: Math.round((await page.viewportSize()).height * 0.5) };
  await page.mouse.move(center.x, center.y);
  await page.mouse.down();
  for (let index = 0; index < 36; index += 1) {
    await delay(75);
    await page.screenshot({
      path: path.join(directory, `frame-${String(index).padStart(2, "0")}.jpg`),
      type: "jpeg",
      quality: 70,
      animations: "allow",
    });
  }
  await page.mouse.up();
  writeJson(path.join(directory, "interaction.json"), { type: "pointer-hold", frames: 36, point: center });
  process.stdout.write("CAPTURED desktop hero hold interaction (36 frames)\n");
}

async function captureFullPageProfile(page, cdp, siteDirectory) {
  const tracingComplete = new Promise((resolve) => cdp.once("Tracing.tracingComplete", resolve));
  await cdp.send("Profiler.enable");
  await cdp.send("Profiler.startPreciseCoverage", { callCount: true, detailed: true });
  await cdp.send("Tracing.start", {
    categories: "devtools.timeline,blink.user_timing,v8.execute,disabled-by-default-devtools.timeline.frame,disabled-by-default-devtools.timeline.stack",
    options: "sampling-frequency=10000",
    transferMode: "ReturnAsStream",
  });
  const scrollHeight = await page.evaluate(() => Math.max(0, document.documentElement.scrollHeight - innerHeight));
  await setScroll(page, 0);
  const steps = 180;
  for (let index = 0; index <= steps; index += 1) {
    await setScroll(page, scrollHeight * (index / steps));
    await delay(55);
  }
  await cdp.send("Tracing.end");
  const { stream } = await tracingComplete;
  const chunks = [];
  while (true) {
    const result = await cdp.send("IO.read", { handle: stream });
    chunks.push(Buffer.from(result.data, result.base64Encoded ? "base64" : "utf8"));
    if (result.eof) break;
  }
  await cdp.send("IO.close", { handle: stream });
  const coverage = await cdp.send("Profiler.takePreciseCoverage");
  await cdp.send("Profiler.stopPreciseCoverage");
  await cdp.send("Profiler.disable");
  fs.writeFileSync(path.join(siteDirectory, "chrome-trace.json.gz"), zlib.gzipSync(Buffer.concat(chunks), { level: 7 }));
  writeJson(path.join(siteDirectory, "js-coverage.json"), coverage.result.map((entry) => ({
    url: entry.url,
    functions: entry.functions.length,
    totalRanges: entry.functions.reduce((sum, fn) => sum + fn.ranges.length, 0),
    executedRanges: entry.functions.reduce((sum, fn) => sum + fn.ranges.filter((range) => range.count > 0).length, 0),
  })));
  process.stdout.write("CAPTURED full-page Chrome performance trace\n");
}

async function audit(slug) {
  const reference = references[slug];
  if (!reference) throw new Error(`Unknown reference: ${slug}`);
  const siteDirectory = path.join(outputRoot, slug);
  ensureDirectory(siteDirectory);

  const browser = await chromium.launch({
    executablePath: chromePath,
    headless: true,
    args: ["--disable-background-timer-throttling", "--disable-renderer-backgrounding"],
  });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  const network = [];
  await cdp.send("DOM.enable");
  await cdp.send("CSS.enable");
  await cdp.send("Performance.enable");
  await cdp.send("Network.enable");
  page.on("response", async (response) => {
    const request = response.request();
    network.push({ url: response.url(), status: response.status(), type: request.resourceType(), method: request.method() });
  });
  await page.addInitScript(() => {
    window.__codexLongTasks = [];
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        window.__codexLongTasks.push({ name: entry.name, startTime: entry.startTime, duration: entry.duration });
      }
    }).observe({ type: "longtask", buffered: true });
  });

  try {
    await page.goto(reference.url, { waitUntil: "domcontentloaded", timeout: 120_000 });
    await delay(7_000);
    const desktopLandmarks = await collectLandmarks(page);
    const desktopRanges = buildTrionnRanges(desktopLandmarks);
    writeJson(path.join(siteDirectory, "desktop-landmarks.json"), desktopLandmarks);
    writeJson(path.join(siteDirectory, "desktop-ranges.json"), desktopRanges);

    const snapshot = await cdp.send("DOMSnapshot.captureSnapshot", {
      computedStyles: ["display", "position", "color", "background-color", "font-family", "font-size", "line-height", "transform", "opacity", "clip-path", "mix-blend-mode"],
      includeDOMRects: true,
      includePaintOrder: true,
    });
    fs.writeFileSync(path.join(siteDirectory, "dom-snapshot.json.gz"), zlib.gzipSync(Buffer.from(JSON.stringify(snapshot)), { level: 7 }));

    await captureFullPageProfile(page, cdp, siteDirectory);
    for (const range of desktopRanges) {
      await captureRange(page, cdp, siteDirectory, range, reference.desktopFrames, "desktop");
    }
    await captureInteractionSequence(page, siteDirectory);

    await page.setViewportSize({ width: 430, height: 932 });
    await setScroll(page, 0);
    await waitForVisualIdle(page, 1_200);
    const mobileLandmarks = await collectLandmarks(page);
    const mobileRanges = buildTrionnRanges(mobileLandmarks);
    writeJson(path.join(siteDirectory, "mobile-landmarks.json"), mobileLandmarks);
    writeJson(path.join(siteDirectory, "mobile-ranges.json"), mobileRanges);
    for (const range of mobileRanges) {
      await captureRange(page, cdp, siteDirectory, range, reference.mobileFrames, "mobile");
    }

    writeJson(path.join(siteDirectory, "network.json"), network);
    writeJson(path.join(siteDirectory, "summary.json"), {
      slug,
      source: reference.url,
      capturedAt: new Date().toISOString(),
      desktop: { framesPerSection: reference.desktopFrames, sections: desktopRanges },
      mobile: { framesPerSection: reference.mobileFrames, sections: mobileRanges },
      networkRequests: network.length,
    });
  } finally {
    await context.close();
    await browser.close();
  }
}

const slug = process.argv[2] || "trionn";
audit(slug).catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
});
