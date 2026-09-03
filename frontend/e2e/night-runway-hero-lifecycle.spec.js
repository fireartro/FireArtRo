const { test, expect } = require("@playwright/test");

// These tests resize the CSS viewport through ultrawide desktop sizes even in
// touch contexts. Exercise Retina density separately instead of rendering a
// fictional 15360px-wide phone surface in the WebKit video recorder.
test.use({ deviceScaleFactor: 1 });

const heroVideoState = (node) => ({
  currentSrc: node.currentSrc,
  currentTime: node.currentTime,
  duration: node.duration,
  paused: node.paused,
  readyState: node.readyState,
  networkState: node.networkState,
  error: node.error ? node.error.code : null,
});

async function expectPlaying(video) {
  await expect.poll(() => video.evaluate((node) => node.readyState), {
    timeout: 25_000,
    message: "hero video should load metadata",
  }).toBeGreaterThanOrEqual(2);
  try {
    await expect.poll(() => video.evaluate((node) => node.paused), {
      timeout: 25_000,
      message: "hero video should not remain paused",
    }).toBe(false);
  } catch (error) {
    console.log("hero video final state", await video.evaluate(heroVideoState));
    throw error;
  }
}

async function expectProgress(video) {
  const before = await video.evaluate(heroVideoState);
  await expect.poll(async () => {
    const after = await video.evaluate(heroVideoState);
    const continued = after.currentTime > before.currentTime + 0.1;
    const looped = before.duration > 0 && before.currentTime > before.duration - 0.75 && after.currentTime < 1;
    return !after.paused && !after.error && (continued || looped);
  }, { message: "video frames must advance after recovery", timeout: 7_000 }).toBe(true);
  const after = await video.evaluate(heroVideoState);
  expect(after.paused).toBe(false);
  expect(after.error).toBeNull();
}

test.describe("hero video lifecycle", () => {
  test("fills every supported aspect ratio with a safe cinematic crop", async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto("/", { waitUntil: "domcontentloaded" });

    const viewports = [
      { width: 320, height: 568, variant: "mobile" },
      { width: 375, height: 812, variant: "mobile-tall" },
      { width: 390, height: 844, variant: "mobile-tall" },
      { width: 430, height: 932, variant: "mobile-tall" },
      { width: 768, height: 1024, variant: "tablet-portrait" },
      { width: 820, height: 1180, variant: "tablet-portrait" },
      { width: 1024, height: 1366, variant: "tablet-portrait" },
      { width: 1440, height: 2000, variant: "tablet-portrait" },
      { width: 844, height: 390, variant: "ultrawide" },
      { width: 932, height: 430, variant: "ultrawide" },
      { width: 1024, height: 768, variant: "tablet-landscape" },
      { width: 1194, height: 834, variant: "tablet-landscape" },
      { width: 1366, height: 1024, variant: "tablet-landscape" },
      { width: 1366, height: 768, variant: "wide" },
      { width: 1440, height: 900, variant: "wide" },
      { width: 1512, height: 982, variant: "wide" },
      { width: 1914, height: 905, variant: "ultrawide" },
      { width: 1920, height: 1080, variant: "wide" },
      { width: 2000, height: 1440, variant: "tablet-landscape" },
      { width: 2560, height: 1440, variant: "wide" },
      { width: 3440, height: 1440, variant: "ultrawide" },
      { width: 3840, height: 2160, variant: "wide" },
      { width: 5120, height: 1440, variant: "ultrawide" },
    ];

    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      await expect.poll(() => page.evaluate(() => ({ width: window.innerWidth, height: window.innerHeight })))
        .toEqual({ width: viewport.width, height: viewport.height });
      await page.waitForTimeout(120);
      const video = page.locator("[data-testid='hero-section'] video");
      await expect(video, `composition at ${viewport.width}x${viewport.height}`)
        .toHaveAttribute("data-media-variant", viewport.variant);

      const framing = await page.getByTestId("hero-section").evaluate((hero) => {
        const media = hero.querySelector(".nr-hero__media");
        const stage = hero.querySelector(".hero-video-stage");
        const surface = hero.querySelector(".hero-media-surface");
        const heroRect = hero.getBoundingClientRect();
        const mediaRect = media.getBoundingClientRect();
        const stageRect = stage.getBoundingClientRect();
        const surfaceStyle = getComputedStyle(surface);
        const backdropStyle = getComputedStyle(stage, "::before");

        return {
          hero: { left: heroRect.left, top: heroRect.top, right: heroRect.right, bottom: heroRect.bottom },
          media: { left: mediaRect.left, top: mediaRect.top, right: mediaRect.right, bottom: mediaRect.bottom },
          stage: { left: stageRect.left, top: stageRect.top, right: stageRect.right, bottom: stageRect.bottom },
          objectFit: surfaceStyle.objectFit,
          objectPosition: surfaceStyle.objectPosition,
          backdropImage: backdropStyle.backgroundImage,
          backdropContent: backdropStyle.content,
          backdropOpacity: Number.parseFloat(backdropStyle.opacity || "0"),
        };
      });

      expect(framing.objectFit, `${viewport.width}x${viewport.height} object fit`).toBe("cover");
      expect(framing.objectPosition, `${viewport.width}x${viewport.height} safe crop`).toBe("50% 50%");
      expect(Math.abs(framing.media.left - framing.hero.left)).toBeLessThanOrEqual(1);
      expect(Math.abs(framing.media.top - framing.hero.top)).toBeLessThanOrEqual(1);
      expect(Math.abs(framing.media.right - framing.hero.right)).toBeLessThanOrEqual(1);
      expect(Math.abs(framing.media.bottom - framing.hero.bottom)).toBeLessThanOrEqual(1);
      expect(Math.abs(framing.stage.left - framing.hero.left)).toBeLessThanOrEqual(1);
      expect(Math.abs(framing.stage.top - framing.hero.top)).toBeLessThanOrEqual(1);
      expect(Math.abs(framing.stage.right - framing.hero.right)).toBeLessThanOrEqual(1);
      expect(Math.abs(framing.stage.bottom - framing.hero.bottom)).toBeLessThanOrEqual(1);
      expect(framing.backdropContent).toBe("none");
      expect(framing.backdropImage).toBe("none");
      expect(framing.backdropOpacity).toBe(0);
    }
  });

  test("keeps the foreground frame stable while scrolling and blends into the gallery", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/", { waitUntil: "domcontentloaded" });

    const boundary = await page.evaluate(() => {
      const hero = document.querySelector("[data-testid='hero-section']");
      const gallery = document.querySelector("[data-testid='home-gallery']");
      const heroRect = hero.getBoundingClientRect();
      const galleryRect = gallery.getBoundingClientRect();
      return galleryRect.top - heroRect.bottom;
    });
    expect(Math.abs(boundary)).toBeLessThanOrEqual(1);

    await page.evaluate(() => {
      const hero = document.querySelector("[data-testid='hero-section']");
      window.scrollTo(0, hero.offsetHeight * 0.72);
    });
    await page.waitForTimeout(120);

    const handoff = await page.getByTestId("hero-section").evaluate((hero) => {
      const media = hero.querySelector(".nr-hero__media");
      const matrix = new DOMMatrixReadOnly(getComputedStyle(media).transform);
      const bridge = getComputedStyle(hero, "::after");
      return {
        mediaScaleX: matrix.a,
        mediaScaleY: matrix.d,
        bridgeContent: bridge.content,
        bridgeHeight: Number.parseFloat(bridge.height),
        bridgeBackground: bridge.backgroundImage,
      };
    });

    expect(Math.abs(handoff.mediaScaleX - 1)).toBeLessThanOrEqual(0.001);
    expect(Math.abs(handoff.mediaScaleY - 1)).toBeLessThanOrEqual(0.001);
    expect(handoff.bridgeContent).not.toBe("none");
    expect(handoff.bridgeHeight).toBeGreaterThanOrEqual(64);
    expect(handoff.bridgeBackground).toContain("linear-gradient");
  });

  test("shows a responsive poster instead of a black stage after an unrecoverable video error", async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 1366 });
    await page.goto("/", { waitUntil: "domcontentloaded" });

    const video = page.locator("[data-testid='hero-section'] video");
    await expect(video).toHaveCount(1);
    await video.dispatchEvent("error");
    await video.dispatchEvent("error");
    await video.dispatchEvent("error");

    const fallback = page.locator("[data-testid='hero-section'] .hero-media-webp");
    await expect(fallback).toBeVisible({ timeout: 12_000 });
    await expect(fallback).toHaveCSS("object-fit", "cover");
    await expect(fallback).toHaveAttribute("src", /fireart-hero-tablet-portrait\.webp/);

    const backdrop = await page.locator(".hero-video-stage").evaluate((stage) => (
      getComputedStyle(stage, "::before").backgroundImage
    ));
    expect(backdrop).toBe("none");
  });

  test("continues playback after a phone rotates into landscape", async ({ page }) => {
    await page.setViewportSize({ width: 430, height: 932 });
    await page.goto("/", { waitUntil: "domcontentloaded" });

    const video = page.locator("[data-testid='hero-section'] video");
    await expect.poll(() => video.evaluate((node) => node.currentSrc)).toMatch(
      /fireart-hero-mobile-tall\.mp4/,
    );
    await expectPlaying(video);

    await page.setViewportSize({ width: 932, height: 430 });
    await expect.poll(() => video.evaluate((node) => node.currentSrc)).toMatch(
      /fireart-hero-ultrawide\.mp4/,
    );
    await expect(video).toHaveAttribute("data-media-variant", "ultrawide");
    await expectPlaying(video);

    await expectProgress(video);
  });

  test("continues playback after leaving the homepage and returning", async ({ page }) => {
    test.setTimeout(60_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/", { waitUntil: "domcontentloaded" });

    const video = page.locator("[data-testid='hero-section'] video");
    await expectPlaying(video);
    const necessaryCookies = page.getByRole("button", { name: "Doar necesare" });
    if (await necessaryCookies.isVisible().catch(() => false)) await necessaryCookies.click();
    await page.getByTestId("hero-secondary-cta").click();
    await expect(page).toHaveURL(/\/galerie$/);
    await expect(page.getByTestId("route-shutter")).toHaveAttribute("data-active", "false");

    await page.goBack({ waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/$/);
    const returnedVideo = page.locator("[data-testid='hero-section'] video");
    await expect(returnedVideo).toHaveCount(1);
    await expect(page.getByTestId("route-shutter")).toHaveAttribute("data-active", "false");
    await expect.poll(() => page.getByTestId("route-shutter").evaluate((node) => getComputedStyle(node).visibility))
      .toBe("hidden");
    await expectPlaying(returnedVideo);

    await expectProgress(returnedVideo);
  });

  test("keeps loading the video on a slow connection instead of locking onto its poster", async ({ page }) => {
    test.setTimeout(45_000);
    await page.route("**/media/fireart-hero-*.mp4*", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 9_000));
      await route.continue().catch(() => {});
    });
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(8_500);
    const video = page.locator("[data-testid='hero-section'] video");
    await expect(video).toHaveCount(1);
    await expectPlaying(video);
    await expectProgress(video);
  });

  test("pauses the hero video offscreen without resetting it and resumes when returning", async ({ page }) => {
    await page.setViewportSize({ width: 430, height: 932 });
    await page.goto("/", { waitUntil: "domcontentloaded" });

    const video = page.locator("[data-testid='hero-section'] video");
    await expectPlaying(video);
    const before = await video.evaluate(heroVideoState);
    const sourceBeforeScroll = await video.getAttribute("src");
    await page.evaluate(() => window.scrollTo(0, document.querySelector("[data-testid='hero-section']").offsetHeight + 120));

    await expect.poll(() => video.evaluate((node) => ({
      paused: node.paused,
      source: node.getAttribute("src"),
    }))).toEqual({ paused: true, source: sourceBeforeScroll });
    await expect.poll(() => video.evaluate((node) => node.currentTime)).toBeGreaterThanOrEqual(before.currentTime - 0.05);

    await page.evaluate(() => window.scrollTo(0, 0));
    await expectPlaying(video);
    await expectProgress(video);
  });

  test("restarts playback after the page is shown again", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const video = page.locator("[data-testid='hero-section'] video");
    await expectPlaying(video);

    await video.evaluate((node) => {
      node.removeAttribute("autoplay");
      node.pause();
      window.dispatchEvent(new Event("pagehide"));
    });
    await expect.poll(() => video.evaluate((node) => node.paused)).toBe(true);
    await page.evaluate(() => window.dispatchEvent(new Event("pageshow")));

    await expect.poll(() => video.evaluate((node) => node.paused), {
      timeout: 5_000,
      message: "hero video should restart after pageshow",
    }).toBe(false);
  });

  test("recovers playback when the window regains focus or connectivity", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const video = page.locator("[data-testid='hero-section'] video");
    await expectPlaying(video);

    await video.evaluate((node) => {
      node.removeAttribute("autoplay");
      node.pause();
      window.dispatchEvent(new Event("focus"));
    });
    await expectPlaying(video);

    await video.evaluate((node) => {
      node.pause();
      window.dispatchEvent(new Event("online"));
    });
    await expectPlaying(video);
  });

  test("uses the optimized landscape source on a tablet in landscape", async ({ page }) => {
    await page.setViewportSize({ width: 1194, height: 834 });
    await page.goto("/", { waitUntil: "domcontentloaded" });

    const video = page.locator("[data-testid='hero-section'] video");
    await expect.poll(() => video.evaluate((node) => node.currentSrc)).toMatch(
      /fireart-hero-tablet-landscape\.mp4/,
    );
    await expect(video).toHaveAttribute("data-media-variant", "tablet-landscape");
    await expectPlaying(video);
  });

  test("keeps the complete hero copy inside every supported viewport", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const viewports = [
      [320, 568],
      [375, 667],
      [390, 844],
      [430, 932],
      [768, 1024],
      [820, 1180],
      [834, 1194],
      [1024, 1366],
      [1024, 768],
      [568, 320],
      [844, 390],
      [932, 430],
      [1194, 834],
      [1366, 768],
      [1366, 1024],
      [1440, 2000],
      [1914, 905],
    ];

    for (const [width, height] of viewports) {
      await page.setViewportSize({ width, height });
      const overflow = await page.locator("[data-testid='hero-section']").evaluate((hero) => {
        const viewportWidth = document.documentElement.clientWidth;
        const viewportHeight = window.innerHeight;
        const nodes = hero.querySelectorAll(
          ".nr-hero__eyebrow, .nr-hero__title, .nr-hero__title-line, "
            + ".nr-hero__keyword-sizer, .nr-hero__keyword-active, "
            + ".nr-hero__description, .nr-hero__actions",
        );

        return [...nodes]
          .map((node) => {
            const rect = node.getBoundingClientRect();
            return {
              selector: node.className,
              left: rect.left,
              right: rect.right,
              top: rect.top,
              bottom: rect.bottom,
            };
          })
          .filter(({ left, right, top, bottom }) => (
            left < -1 || right > viewportWidth + 1 || top < -1 || bottom > viewportHeight + 1
          ));
      });

      expect(overflow, `hero copy overflow at ${width}x${height}`).toEqual([]);
    }
  });

  test("allows enlarged text to reflow without clipping the hero title or actions", async ({ page }) => {
    for (const [width, height] of [[375, 812], [844, 390], [1366, 768]]) {
      await page.setViewportSize({ width, height });
      await page.goto("/", { waitUntil: "domcontentloaded" });
      await page.addStyleTag({ content: "html { font-size: 200% !important; }" });
      await expect.poll(() => page.getByTestId("hero-section").evaluate((hero) => {
        const frame = hero.getBoundingClientRect();
        return [...hero.querySelectorAll(".nr-hero__title, .nr-hero__actions")].every((node) => {
          const box = node.getBoundingClientRect();
          return box.left >= 0 && box.right <= innerWidth && box.bottom <= frame.bottom + 1;
        });
      }), { message: `enlarged hero text at ${width}x${height}` }).toBe(true);
    }
  });

  test("keeps every social control reachable after rotating a short viewport", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    for (const [width, height] of [[375, 812], [844, 390], [568, 320], [1024, 600], [1366, 768]]) {
      await page.setViewportSize({ width, height });
      await expect.poll(() => page.locator("[data-testid='social-dock']:visible .social-dock-link").evaluateAll((links) => {
        if (links.length !== 5) return false;
        return links.every((node) => {
          const rect = node.getBoundingClientRect();
          return rect.top >= -1 && rect.bottom <= innerHeight + 1
            && rect.left >= -1 && rect.right <= innerWidth + 1 && rect.height >= 44;
        });
      }), { message: `social controls at ${width}x${height}` }).toBe(true);
    }
  });

  test("scales the full hero stage to every viewport instead of forcing a fixed minimum height", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });

    const viewports = [
      [320, 568],
      [375, 667],
      [667, 375],
      [844, 390],
      [904, 580],
      [1024, 600],
      [1280, 720],
      [1512, 982],
      [1728, 1117],
      [2560, 1440],
    ];

    for (const [width, height] of viewports) {
      await page.setViewportSize({ width, height });
      const layout = await page.getByTestId("hero-section").evaluate((hero) => {
        const rect = hero.getBoundingClientRect();
        const actions = hero.querySelector(".nr-hero__actions");
        const actionsRect = actions?.getBoundingClientRect();

        return {
          width: rect.width,
          height: rect.height,
          contentBottom: actionsRect?.bottom ?? 0,
          viewportWidth: document.documentElement.getBoundingClientRect().width,
          viewportHeight: window.innerHeight,
        };
      });

      expect(layout.width, `hero width at ${width}x${height}`).toBeGreaterThanOrEqual(layout.viewportWidth - 1);
      expect(layout.height, `hero height at ${width}x${height}`).toBeLessThanOrEqual(height + 1);
      expect(layout.contentBottom, `hero copy bottom at ${width}x${height}`).toBeLessThanOrEqual(height + 1);
    }
  });
});
