const { expect, test } = require("@playwright/test");

async function inspectVideoFrame(page, src, timestamp) {
  return page.evaluate(async ({ mediaSrc, at }) => {
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.style.cssText = "position:fixed;left:-99999px;top:0;width:1px;height:1px";
    document.body.appendChild(video);

    const waitFor = (eventName) => new Promise((resolve, reject) => {
      const timeout = window.setTimeout(() => reject(new Error(`Timed out waiting for ${eventName}: ${mediaSrc}`)), 10_000);
      video.addEventListener(eventName, () => {
        window.clearTimeout(timeout);
        resolve();
      }, { once: true });
      video.addEventListener("error", () => {
        window.clearTimeout(timeout);
        reject(new Error(`Could not decode ${mediaSrc}`));
      }, { once: true });
    });

    try {
      const metadataReady = waitFor("loadedmetadata");
      video.src = mediaSrc;
      video.load();
      await metadataReady;

      const frameReady = waitFor("seeked");
      video.currentTime = Math.min(at, Math.max(0, video.duration - 0.05));
      await frameReady;

      const width = 480;
      const height = Math.round((video.videoHeight / video.videoWidth) * width);
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      context.drawImage(video, 0, 0, width, height);
      const pixels = context.getImageData(0, 0, width, height).data;
      const isLandscape = width / height > 1;

      const emberColumnCounts = new Uint16Array(width);
      const emberRowCounts = new Uint16Array(height);
      let emberPixels = 0;

      const emberTop = Math.floor(height * (isLandscape ? 0.52 : 0.7));
      const emberBottom = Math.ceil(height * (isLandscape ? 0.68 : 0.94));
      for (let y = emberTop; y < emberBottom; y += 1) {
        for (let x = 0; x < width; x += 1) {
          const offset = (y * width + x) * 4;
          const red = pixels[offset];
          const green = pixels[offset + 1];
          const blue = pixels[offset + 2];
          const isEmber = red > 145
            && red > green * 1.35
            && red - blue > 55
            && green > 35
            && green < 175
            && blue < 145;
          if (!isEmber) continue;
          emberColumnCounts[x] += 1;
          emberRowCounts[y] += 1;
          emberPixels += 1;
        }
      }

      // The drone photograph also contains tiny orange lights. Requiring a
      // sustained vertical run isolates the large, flat title glyphs.
      const columnThreshold = Math.max(6, Math.floor(height * (isLandscape ? 0.04 : 0.02)));
      const rowThreshold = Math.max(3, Math.floor(width * 0.006));
      const emberColumns = Array.from(emberColumnCounts, (count, index) => ({ count, index }))
        .filter(({ count }) => count > columnThreshold)
        .map(({ index }) => index);
      const emberRows = Array.from(emberRowCounts, (count, index) => ({ count, index }))
        .filter(({ count }) => count > rowThreshold)
        .map(({ index }) => index);

      const edgeScore = (fromX, toX) => {
        let total = 0;
        let samples = 0;
        for (let y = 1; y < height - 1; y += 2) {
          for (let x = Math.max(1, fromX); x < Math.min(width - 1, toX); x += 2) {
            const offset = (y * width + x) * 4;
            const right = (y * width + x + 1) * 4;
            const down = ((y + 1) * width + x) * 4;
            for (let channel = 0; channel < 3; channel += 1) {
              total += Math.abs(pixels[offset + channel] - pixels[right + channel]);
              total += Math.abs(pixels[offset + channel] - pixels[down + channel]);
              samples += 2;
            }
          }
        }
        return total / Math.max(1, samples);
      };

      const edgeWidth = Math.floor(width * 0.12);
      const edgeDetail = (edgeScore(0, edgeWidth) + edgeScore(width - edgeWidth, width)) / 2;
      const centerDetail = edgeScore(Math.floor(width * 0.35), Math.ceil(width * 0.65));

      return {
        width,
        height,
        emberPixels,
        emberBox: emberColumns.length && emberRows.length ? {
          left: Math.min(...emberColumns) / width,
          right: Math.max(...emberColumns) / width,
          top: Math.min(...emberRows) / height,
          bottom: Math.max(...emberRows) / height,
        } : null,
        edgeDetailRatio: edgeDetail / Math.max(0.001, centerDetail),
      };
    } finally {
      video.removeAttribute("src");
      video.load();
      video.remove();
    }
  }, { mediaSrc: src, at: timestamp });
}

test("the baked combo title stays in the website-safe area in every delivered crop", async ({ page }) => {
  await page.goto("/#acasa", { waitUntil: "domcontentloaded" });

  const landscapeVariants = ["wide", "ultrawide", "tablet-landscape"];
  for (const variant of landscapeVariants) {
    const frame = await inspectVideoFrame(page, `/media/fireart-hero-${variant}.mp4`, 16.7);
    expect(frame.emberPixels, `${variant} ember title signal`).toBeGreaterThan(frame.width * frame.height * 0.003);
    expect(frame.emberBox, `${variant} ember title bounds`).not.toBeNull();
    expect(frame.emberBox.left, `${variant} title must clear the live copy`).toBeGreaterThanOrEqual(0.46);
    expect(frame.emberBox.right, `${variant} title must remain visible`).toBeLessThanOrEqual(0.985);
  }

  const portraitVariants = ["tablet-portrait", "mobile", "mobile-tall"];
  for (const variant of portraitVariants) {
    const frame = await inspectVideoFrame(page, `/media/fireart-hero-${variant}.mp4`, 16.7);
    expect(frame.emberPixels, `${variant} ember title signal`).toBeGreaterThan(frame.width * frame.height * 0.003);
    expect(frame.emberBox, `${variant} ember title bounds`).not.toBeNull();
    expect(frame.emberBox.top, `${variant} title must stay below the live copy`).toBeGreaterThanOrEqual(0.58);
    expect(frame.emberBox.bottom, `${variant} title must remain visible`).toBeLessThanOrEqual(0.92);
  }
});

test("drone photographs retain real edge detail instead of a blurred duplicate", async ({ page }) => {
  await page.goto("/#acasa", { waitUntil: "domcontentloaded" });

  const containedSceneTimes = [3.9, 5.5, 10.7, 13.2, 15.7, 16.7];
  const frames = [];
  for (const timestamp of containedSceneTimes) {
    frames.push(await inspectVideoFrame(page, "/media/fireart-hero-wide.mp4", timestamp));
  }

  const meanEdgeDetail = frames.reduce((total, frame) => total + frame.edgeDetailRatio, 0) / frames.length;
  expect(meanEdgeDetail, "average outer-edge detail").toBeGreaterThanOrEqual(0.34);
  // Individual photographs may naturally contain dark sky at one edge. The
  // aggregate is the stable signal that distinguishes a real crop from the
  // previous blurred side-fill treatment.
  expect(frames.every((frame) => Number.isFinite(frame.edgeDetailRatio))).toBe(true);
});

test("live hero copy stays outside every baked-title zone", async ({ page }) => {
  const cases = [
    { width: 844, height: 390, orientation: "landscape", variant: "ultrawide" },
    { width: 1024, height: 768, orientation: "landscape", variant: "tablet-landscape" },
    { width: 1512, height: 982, orientation: "landscape", variant: "wide" },
    { width: 2560, height: 1440, orientation: "landscape", variant: "wide" },
    { width: 3440, height: 1440, orientation: "landscape", variant: "ultrawide" },
    { width: 5120, height: 1440, orientation: "landscape", variant: "ultrawide" },
    { width: 375, height: 812, orientation: "portrait", variant: "mobile-tall" },
    { width: 430, height: 932, orientation: "portrait", variant: "mobile-tall" },
    { width: 768, height: 1024, orientation: "portrait", variant: "tablet-portrait" },
  ];

  await page.goto("/#acasa", { waitUntil: "domcontentloaded" });
  const bakedBounds = {};
  for (const variant of [...new Set(cases.map((item) => item.variant))]) {
    bakedBounds[variant] = (await inspectVideoFrame(page, `/media/fireart-hero-${variant}.mp4`, 16.7)).emberBox;
  }

  for (const viewport of cases) {
    await page.setViewportSize(viewport);
    const bounds = await page.locator(".nr-hero__content").evaluate((node) => {
      const visibleChildren = [...node.children].filter((child) => !child.classList.contains("nr-hero__accessible-title"));
      const rects = visibleChildren.map((child) => child.getBoundingClientRect());
      return {
        right: Math.max(...rects.map((rect) => rect.right)) / window.innerWidth,
        bottom: Math.max(...rects.map((rect) => rect.bottom)) / window.innerHeight,
      };
    });

    if (viewport.orientation === "landscape") {
      expect(bounds.right, `${viewport.width}x${viewport.height} live copy`).toBeLessThanOrEqual(
        bakedBounds[viewport.variant].left - 0.012,
      );
    } else {
      expect(bounds.bottom, `${viewport.width}x${viewport.height} live copy`).toBeLessThanOrEqual(
        bakedBounds[viewport.variant].top - 0.012,
      );
    }
  }
});
