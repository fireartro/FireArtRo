const { expect, test } = require("@playwright/test");

async function measureEdgeDetail(page, src) {
  return page.evaluate(async (imageSrc) => {
    const image = new Image();
    image.src = imageSrc;
    await image.decode();

    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;

    const score = (fromX, toX) => {
      let total = 0;
      let samples = 0;
      const stride = 4;
      for (let y = stride; y < canvas.height - stride; y += stride) {
        for (let x = fromX + stride; x < toX - stride; x += stride) {
          const offset = (y * canvas.width + x) * 4;
          const right = (y * canvas.width + x + stride) * 4;
          const down = ((y + stride) * canvas.width + x) * 4;
          for (let channel = 0; channel < 3; channel += 1) {
            total += Math.abs(pixels[offset + channel] - pixels[right + channel]);
            total += Math.abs(pixels[offset + channel] - pixels[down + channel]);
            samples += 2;
          }
        }
      }
      return total / samples;
    };

    const edgeWidth = Math.floor(canvas.width * 0.15);
    const centerStart = Math.floor(canvas.width * 0.35);
    const centerEnd = Math.floor(canvas.width * 0.65);
    const edge = (score(0, edgeWidth) + score(canvas.width - edgeWidth, canvas.width)) / 2;
    const center = score(centerStart, centerEnd);
    return { edge, center, ratio: edge / center };
  }, src);
}

test("ultrawide poster has real image detail at both outer edges", async ({ page }) => {
  await page.goto("/#acasa");
  const detail = await measureEdgeDetail(page, "/media/fireart-hero-ultrawide.webp");

  expect(detail.center).toBeGreaterThan(1);
  expect(detail.ratio).toBeGreaterThan(0.55);
});

test("hero is full-bleed and cinematic gallery scales on a 32:9 viewport", async ({ page }) => {
  await page.setViewportSize({ width: 5120, height: 1440 });
  await page.goto("/#acasa");

  const video = page.locator(".hero-media-surface");
  await expect(video).toBeVisible();

  const geometry = await page.evaluate(() => {
    const heroNode = document.querySelector(".nr-hero");
    const videoNode = document.querySelector(".hero-media-surface");
    const stageNode = document.querySelector(".hero-video-stage");
    const galleryNode = document.querySelector(".fa-work__viewport");
    const panelNode = document.querySelector(".fa-work__card");
    const mediaNode = document.querySelector(".fa-work__card-inner");

    if (!heroNode || !videoNode || !stageNode || !galleryNode || !panelNode || !mediaNode) {
      throw new Error("Expected hero and gallery nodes to be present");
    }

    const heroRect = heroNode.getBoundingClientRect();
    const videoRect = videoNode.getBoundingClientRect();
    const backdrop = getComputedStyle(stageNode, "::before");

    return {
      hero: { width: heroRect.width, height: heroRect.height },
      video: { width: videoRect.width, height: videoRect.height },
      fit: getComputedStyle(videoNode).objectFit,
      backdropOpacity: Number.parseFloat(backdrop.opacity || "0"),
      viewportWidth: window.innerWidth,
      galleryWidth: galleryNode.getBoundingClientRect().width,
      panelWidth: panelNode.getBoundingClientRect().width,
      mediaWidth: mediaNode.getBoundingClientRect().width,
      documentOverflow: document.documentElement.scrollWidth - window.innerWidth,
    };
  });

  expect(Math.abs(geometry.hero.width - geometry.video.width)).toBeLessThanOrEqual(1);
  expect(Math.abs(geometry.hero.height - geometry.video.height)).toBeLessThanOrEqual(1);
  expect(geometry.fit).toBe("cover");
  expect(geometry.backdropOpacity).toBe(0);
  expect(geometry.galleryWidth).toBeGreaterThanOrEqual(geometry.viewportWidth * 0.98);
  expect(geometry.panelWidth).toBeGreaterThanOrEqual(1_200);
  expect(geometry.panelWidth).toBeLessThanOrEqual(1_441);
  expect(geometry.mediaWidth).toBeGreaterThanOrEqual(1_000);
  expect(geometry.mediaWidth).toBeLessThanOrEqual(1_201);
  expect(geometry.documentOverflow).toBeLessThanOrEqual(1);
});

test("every viewport family selects a full-bleed composition without overflow", async ({ page }) => {
  const cases = [
    { width: 375, height: 812, variant: "mobile-tall" },
    { width: 430, height: 932, variant: "mobile-tall" },
    { width: 412, height: 732, variant: "mobile" },
    { width: 768, height: 1024, variant: "tablet-portrait" },
    { width: 1024, height: 768, variant: "tablet-landscape" },
    { width: 1366, height: 768, variant: "wide" },
    { width: 1440, height: 900, variant: "wide" },
    { width: 1512, height: 982, variant: "wide" },
    { width: 1920, height: 1080, variant: "wide" },
    { width: 2560, height: 1440, variant: "wide" },
    { width: 3440, height: 1440, variant: "ultrawide" },
    { width: 3840, height: 2160, variant: "wide" },
    { width: 5120, height: 1440, variant: "ultrawide" },
  ];

  await page.setViewportSize(cases[0]);
  await page.goto("/#acasa");

  for (const viewport of cases) {
    await page.setViewportSize(viewport);
    const video = page.locator(".hero-media-surface");
    await expect(video).toHaveAttribute("data-media-variant", viewport.variant);

    const state = await page.evaluate(() => {
      const hero = document.querySelector(".nr-hero")?.getBoundingClientRect();
      const media = document.querySelector(".hero-media-surface")?.getBoundingClientRect();
      const title = document.querySelector(".nr-hero__title")?.getBoundingClientRect();
      if (!hero || !media || !title) throw new Error("Hero geometry is unavailable");
      return {
        heroWidth: hero.width,
        heroHeight: hero.height,
        mediaWidth: media.width,
        mediaHeight: media.height,
        titleLeft: title.left,
        titleRight: title.right,
        titleTop: title.top,
        titleBottom: title.bottom,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        overflow: document.documentElement.scrollWidth - window.innerWidth,
      };
    });

    expect(Math.abs(state.heroWidth - state.mediaWidth)).toBeLessThanOrEqual(1);
    expect(Math.abs(state.heroHeight - state.mediaHeight)).toBeLessThanOrEqual(1);
    expect(state.titleLeft).toBeGreaterThanOrEqual(0);
    expect(state.titleRight).toBeLessThanOrEqual(state.viewportWidth);
    expect(state.titleTop).toBeGreaterThanOrEqual(0);
    expect(state.titleBottom).toBeLessThanOrEqual(state.viewportHeight);
    expect(state.overflow).toBeLessThanOrEqual(1);
  }
});
