const { test, expect } = require("@playwright/test");

const openGallery = async (page, viewport = { width: 1440, height: 900 }) => {
  await page.setViewportSize(viewport);
  const baseUrl = process.env.GALLERY_BASE_URL || "";
  await page.goto(`${baseUrl}/galerie`, { waitUntil: "domcontentloaded" });
  const necessaryCookies = page.getByRole("button", { name: "Doar necesare" });
  if (await necessaryCookies.isVisible().catch(() => false)) await necessaryCookies.click();
  await expect(page.getByTestId("gallery-grid")).toBeVisible();
  const firstImage = page.getByTestId("gallery-card").first().locator("img");
  await expect(firstImage).toBeVisible();
  await expect.poll(() => firstImage.evaluate((image) => image.naturalWidth)).toBeGreaterThan(0);
};

test.describe("Editorial mosaic gallery", () => {
  test("renders a compact adaptive photo mosaic", async ({ page }) => {
    await openGallery(page);

    await expect(page.locator("main[data-design='night-runway'][data-gallery-design='editorial-mosaic']")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: "Galerie" })).toHaveCount(1);
    await expect(page.getByTestId("gallery-card")).toHaveCount(205);
    await expect(page.locator(".nr-gallery-card__copy")).toHaveCount(0);
    await expect(page.locator('[data-media-id="photo-drone-show"]')).toHaveCount(0);

    const cardWidths = await page.getByTestId("gallery-card").evaluateAll((cards) => (
      cards.slice(0, 16).map((card) => card.getBoundingClientRect().width)
    ));
    cardWidths.forEach((width) => expect(width).toBeGreaterThan(210));

    const cards = page.getByTestId("gallery-card");
    for (let index = 0; index < Math.min(await cards.count(), 12); index += 1) {
      const card = cards.nth(index);
      await card.scrollIntoViewIfNeeded();
      await expect.poll(() => card.locator("img").evaluate((image) => image.naturalWidth)).toBeGreaterThan(0);
    }

    const metrics = await page.evaluate(() => {
      const cards = [...document.querySelectorAll("[data-testid='gallery-card']")];
      const inspectedCards = cards.slice(0, 12);
      const images = inspectedCards.map((card) => card.querySelector("img"));
      return {
        viewport: document.documentElement.clientWidth,
        document: document.documentElement.scrollWidth,
        rows: new Set(cards.map((card) => Math.round(card.getBoundingClientRect().top))).size,
        naturalRatios: images.map((image) => image.naturalWidth / image.naturalHeight),
        cardRatios: inspectedCards.map((card) => {
          const box = card.getBoundingClientRect();
          return box.width / box.height;
        }),
      };
    });

    expect(metrics.document).toBeLessThanOrEqual(metrics.viewport + 1);
    expect(metrics.rows).toBeGreaterThan(1);
    metrics.cardRatios.forEach((ratio, index) => {
      const natural = metrics.naturalRatios[index];
      const expected = natural < 0.6 ? 0.75 : natural > 2 ? 1.6 : natural;
      expect(Math.abs(ratio - expected)).toBeLessThan(0.08);
    });
  });

  test("rebuilds formerly over-cropped photographs from the full-width source", async ({ page }) => {
    await openGallery(page, { width: 1854, height: 905 });

    const card = page.locator('[data-media-id="gallery-import-002"]');
    await card.scrollIntoViewIfNeeded();
    await expect.poll(() => card.locator("img").evaluate((image) => image.naturalWidth)).toBeGreaterThan(0);

    const cardMetrics = await card.evaluate((element) => {
      const image = element.querySelector("img");
      const frame = element.getBoundingClientRect();
      return {
        natural: image.naturalWidth / image.naturalHeight,
        frame: frame.width / frame.height,
        source: image.currentSrc,
      };
    });

    expect(cardMetrics.natural).toBeCloseTo(0.5625, 3);
    expect(cardMetrics.frame).toBeCloseTo(0.75, 1);
    expect(cardMetrics.source).toContain("v=source-crop-20260828");

    await card.locator("button").click();
    const dialog = page.locator(".nr-gallery-lightbox[role='dialog']");
    await expect(dialog).toBeVisible();
    await expect.poll(() => dialog.locator("img").evaluate((image) => image.naturalWidth)).toBe(1080);

    const previewMetrics = await dialog.evaluate((element) => {
      const image = element.querySelector("img");
      const frame = element.querySelector(".nr-gallery-lightbox__frame").getBoundingClientRect();
      const rendered = image.getBoundingClientRect();
      return {
        natural: image.naturalWidth / image.naturalHeight,
        frame: frame.width / frame.height,
        rendered: rendered.width / rendered.height,
        renderedWidth: rendered.width,
      };
    });

    expect(Math.abs(previewMetrics.frame - previewMetrics.natural)).toBeLessThan(0.01);
    expect(Math.abs(previewMetrics.rendered - previewMetrics.natural)).toBeLessThan(0.01);
    expect(previewMetrics.renderedWidth).toBeGreaterThan(450);
  });

  test("ships the curated photographs without solid black capture borders", async ({ page }) => {
    await openGallery(page);

    for (const mediaId of ["gallery-import-001", "gallery-import-002", "gallery-import-006"]) {
      const image = page.locator(`[data-media-id="${mediaId}"] img`);
      await image.scrollIntoViewIfNeeded();
      await expect.poll(() => image.evaluate((node) => node.naturalWidth)).toBeGreaterThan(0);

      const darkestEdgeShare = await image.evaluate((node) => {
        const canvas = document.createElement("canvas");
        canvas.width = node.naturalWidth;
        canvas.height = node.naturalHeight;
        const context = canvas.getContext("2d", { willReadFrequently: true });
        context.drawImage(node, 0, 0);
        const countDark = (x, y, width, height) => {
          const pixels = context.getImageData(x, y, width, height).data;
          let dark = 0;
          for (let index = 0; index < pixels.length; index += 4) {
            const luminance = (pixels[index] * 54 + pixels[index + 1] * 183 + pixels[index + 2] * 19) / 256;
            if (luminance <= 10) dark += 1;
          }
          return dark / (pixels.length / 4);
        };
        return Math.max(
          countDark(0, 0, canvas.width, 1),
          countDark(0, canvas.height - 1, canvas.width, 1),
          countDark(0, 0, 1, canvas.height),
          countDark(canvas.width - 1, 0, 1, canvas.height),
        );
      });

      expect(darkestEdgeShare, mediaId).toBeLessThan(0.985);
    }
  });

  test("publishes a clean, SEO-named FireArtRo photo catalog", async ({ page }) => {
    await openGallery(page);

    const cards = page.getByTestId("gallery-card");
    expect(await cards.count()).toBeGreaterThanOrEqual(40);

    const sources = await cards.locator("img").evaluateAll((images) => images.map((image) => image.getAttribute("src") || ""));
    expect(sources.filter((source) => {
      const pathname = new URL(source, "http://localhost").pathname;
      return pathname.includes("/media/gallery/fireartro-") && pathname.endsWith(".webp");
    })).toHaveLength(205);
  });

  test("exposes only the curated fireworks and drone categories", async ({ page }) => {
    await openGallery(page);

    const labels = await page.getByTestId("gallery-filters").locator("button span").allTextContents();
    expect(labels).toEqual([
      "Toate",
      "Artificii de zi",
      "Artificii de noapte",
      "Drone show",
    ]);
  });

  test("migrates an existing Admin catalog without removing a custom photograph", async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("fireartro-managed-content-v1", JSON.stringify({
        mediaItems: [{
          id: "admin-custom-photo",
          type: "image",
          title: "Fotografie administrata",
          category: "Custom",
          thumbnail: "/media/fireworks-sky.webp",
          src: "/media/fireworks-sky.webp",
          alt: "Fotografie incarcata prin Admin",
          order: 999,
        }],
      }));
    });

    await openGallery(page);
    await expect(page.getByTestId("gallery-card")).toHaveCount(206);
    await expect(page.locator('[data-testid="gallery-card"][data-media-id="admin-custom-photo"]')).toBeVisible();
  });

  test("migrates the previous catalog without restoring its generic drone placeholder", async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("fireartro-managed-content-v1", JSON.stringify({
        mediaCatalogVersion: "fireartro-gallery-2026-v3",
        mediaItems: [{
          id: "photo-drone-show",
          type: "image",
          title: "Placeholder drone",
          category: "Drone show",
          thumbnail: "/media/drone-show.webp",
          src: "/media/drone-show.webp",
          alt: "Imagine generica",
          order: 1,
        }],
      }));
    });

    await openGallery(page);
    await expect(page.locator('[data-media-id="photo-drone-show"]')).toHaveCount(0);
    await expect(page.getByTestId("gallery-card")).toHaveCount(205);
  });

  test("does not resurrect removed photographs during an Admin catalog migration", async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("fireartro-managed-content-v1", JSON.stringify({
        mediaCatalogVersion: "fireartro-gallery-2026-v2",
        mediaItems: [
          {
            id: "gallery-import-137",
            type: "image",
            title: "Fotografie eliminata",
            category: "Nunta",
            thumbnail: "/media/gallery/fireartro-nunta-moment-special-137.webp",
            src: "/media/gallery/fireartro-nunta-moment-special-137.webp",
            alt: "Fotografie veche eliminata din catalog",
            order: 137,
          },
          {
            id: "admin-custom-photo",
            type: "image",
            title: "Fotografie administrata",
            category: "Custom",
            thumbnail: "/media/fireworks-sky.webp",
            src: "/media/fireworks-sky.webp",
            alt: "Fotografie incarcata prin Admin",
            order: 999,
          },
        ],
      }));
    });

    await openGallery(page);
    await expect(page.locator('[data-testid="gallery-card"][data-media-id="gallery-import-137"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="gallery-card"][data-media-id="admin-custom-photo"]')).toBeVisible();
  });

  test("filters the collection and keeps URL state", async ({ page }) => {
    await openGallery(page);
    const filters = page.getByTestId("gallery-filters");
    const allButton = filters.getByRole("button", { name: /^Toate/ });
    await expect(allButton).toHaveAttribute("aria-pressed", "true");

    const initialCount = await page.getByTestId("gallery-card").count();
    const categoryButton = filters.getByRole("button").nth(1);
    await categoryButton.click();

    await expect(page).toHaveURL(/filtru=/);
    await expect(categoryButton).toHaveAttribute("aria-pressed", "true");
    expect(await page.getByTestId("gallery-card").count()).toBeLessThanOrEqual(initialCount);
  });

  test("interleaves all gallery categories in the complete collection", async ({ page }) => {
    await openGallery(page);
    const categories = await page.getByTestId("gallery-card").evaluateAll((cards) => (
      cards.slice(0, 12).map((card) => card.dataset.category)
    ));

    expect(new Set(categories)).toEqual(new Set(["Artificii de zi", "Artificii de noapte", "Drone show"]));
    categories.slice(1).forEach((category, index) => {
      expect(category).not.toBe(categories[index]);
    });
  });

  test("opens a distraction-free image preview", async ({ page }) => {
    await openGallery(page);
    await page.getByTestId("gallery-card").first().locator("button").click();

    const dialog = page.locator(".nr-gallery-lightbox[role='dialog']");
    await expect(dialog).toBeVisible();
    await expect(page).toHaveURL(/media=/);
    await expect(dialog.locator("img")).toHaveCount(1);
    await expect(dialog.locator(".nr-gallery-lightbox__copy")).toHaveCount(0);
    await expect(dialog.getByRole("button", { name: "Imaginea anterioară" })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Imaginea următoare" })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Close" })).toBeVisible();

    const firstSource = await dialog.locator("img").getAttribute("src");
    await dialog.getByRole("button", { name: "Imaginea următoare" }).click();
    await expect(dialog.locator("img")).not.toHaveAttribute("src", firstSource);
    await expect(page).toHaveURL(/media=/);

    await page.keyboard.press("ArrowLeft");
    await expect(dialog.locator("img")).toHaveAttribute("src", firstSource);

    await expect.poll(() => dialog.evaluate((element) => {
      const image = element.querySelector("img");
      const frame = element.querySelector(".nr-gallery-lightbox__frame").getBoundingClientRect();
      const naturalRatio = image.naturalWidth / image.naturalHeight;
      return Math.abs((frame.width / frame.height) - naturalRatio);
    })).toBeLessThan(0.02);

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(page).not.toHaveURL(/media=/);
  });

  test("anchors preview controls to the preview frame", async ({ page }) => {
    await openGallery(page);
    await page.getByTestId("gallery-card").first().locator("button").click();

    const dialog = page.locator(".nr-gallery-lightbox[role='dialog']");
    await expect(dialog).toBeVisible();

    const readControlOffsets = () => dialog.evaluate((element) => {
      const frame = element.getBoundingClientRect();
      const close = element.querySelector(":scope > button").getBoundingClientRect();
      const previous = element.querySelector(".nr-gallery-lightbox__nav--previous").getBoundingClientRect();
      const next = element.querySelector(".nr-gallery-lightbox__nav--next").getBoundingClientRect();
      const centerY = frame.top + (frame.height / 2);

      return {
        closeTop: close.top - frame.top,
        closeRight: frame.right - close.right,
        previousLeft: previous.left - frame.left,
        previousCenterY: (previous.top + (previous.height / 2)) - centerY,
        nextRight: frame.right - next.right,
        nextCenterY: (next.top + (next.height / 2)) - centerY,
      };
    });

    const firstOffsets = await readControlOffsets();
    const firstSource = await dialog.locator("img").getAttribute("src");
    await dialog.getByRole("button", { name: "Imaginea următoare" }).click();
    await expect.poll(() => dialog.locator("img").getAttribute("src")).not.toBe(firstSource);
    await page.waitForTimeout(120);

    const secondOffsets = await readControlOffsets();
    Object.keys(firstOffsets).forEach((key) => {
      expect(Math.abs(secondOffsets[key] - firstOffsets[key])).toBeLessThan(1.5);
    });
  });

  test("stays readable and overflow-free on mobile", async ({ page }) => {
    await openGallery(page, { width: 390, height: 844 });

    const metrics = await page.evaluate(() => {
      const cards = [...document.querySelectorAll("[data-testid='gallery-card']")];
      return {
        viewport: document.documentElement.clientWidth,
        document: document.documentElement.scrollWidth,
        cardWidths: cards.map((card) => card.getBoundingClientRect().width),
        cardLefts: cards.map((card) => card.getBoundingClientRect().left),
      };
    });

    expect(metrics.document).toBeLessThanOrEqual(metrics.viewport + 1);
    metrics.cardWidths.forEach((width) => expect(width).toBeGreaterThan(330));
    metrics.cardLefts.forEach((left) => expect(left).toBeGreaterThanOrEqual(15));

    const firstCard = page.getByTestId("gallery-card").first();
    await firstCard.locator("button").click();
    const dialog = page.locator(".nr-gallery-lightbox[role='dialog']");
    await expect(dialog).toBeVisible();
    await expect(dialog.locator("img")).toBeVisible();
  });

  test("requests every gallery image without waiting for hover", async ({ page }) => {
    await openGallery(page);
    const loadingModes = await page.getByTestId("gallery-card").locator("img").evaluateAll((images) => (
      [...new Set(images.map((image) => image.loading))]
    ));

    expect(loadingModes).toEqual(["eager"]);
  });

  test("shows gallery imagery without a hover-only reveal", async ({ page }) => {
    await openGallery(page);
    const card = page.getByTestId("gallery-card").first();
    const visualState = await card.evaluate((element) => ({
      animationName: getComputedStyle(element).animationName,
      cardOpacity: Number(getComputedStyle(element).opacity),
      filter: getComputedStyle(element.querySelector("img")).filter,
      expandOpacity: Number(getComputedStyle(element.querySelector(".nr-gallery-card__expand")).opacity),
    }));

    expect(visualState.animationName).toBe("none");
    expect(visualState.cardOpacity).toBe(1);
    expect(visualState.filter).toBe("none");
    expect(visualState.expandOpacity).toBeGreaterThan(0);
  });
});
