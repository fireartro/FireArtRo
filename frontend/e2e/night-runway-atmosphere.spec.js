const { expect, test } = require("@playwright/test");

const necessaryConsent = {
  necessary: true,
  analytics: false,
  marketing: false,
  savedAt: "2026-08-31T00:00:00.000Z",
  expiresAt: "2099-08-31T00:00:00.000Z",
};

test.beforeEach(async ({ page }) => {
  await page.addInitScript((consent) => {
    window.localStorage.setItem("fireartro-cookie-consent-v1", JSON.stringify(consent));
  }, necessaryConsent);
});

test("homepage gallery is substantial and requested sections use photographic atmosphere", async ({ page }) => {
  await page.setViewportSize({ width: 1512, height: 982 });
  await page.goto("/#acasa", { waitUntil: "domcontentloaded" });

  const metrics = await page.evaluate(() => {
    const background = (selector, pseudo = "::before") =>
      getComputedStyle(document.querySelector(selector), pseudo).backgroundImage;
    const imageTreatment = (selector, pseudo) => {
      const style = getComputedStyle(document.querySelector(selector), pseudo);
      return {
        image: style.backgroundImage,
        opacity: style.opacity,
        filter: style.filter,
      };
    };
    const card = document.querySelector(".fa-work__card-inner").getBoundingClientRect();
    const galleryImage = imageTreatment(".fa-work__sticky", "::before");
    const packagesImage = imageTreatment(".fa-packages", "::before");
    const aboutImage = imageTreatment(".fa-about__image");

    return {
      cardRatio: card.width / window.innerWidth,
      gallery: galleryImage.image,
      packages: packagesImage.image,
      imageOpacities: [galleryImage.opacity, packagesImage.opacity, aboutImage.opacity],
      imageFilters: [galleryImage.filter, packagesImage.filter, aboutImage.filter],
      packagesScrim: background(".fa-packages", "::after"),
      aboutScrim: background(".fa-about__shade", ""),
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });

  expect(metrics.cardRatio).toBeGreaterThanOrEqual(0.54);
  expect(metrics.cardRatio).toBeLessThanOrEqual(0.6);
  expect(metrics.gallery).toContain("fireartro-drone-show-neversea-show-img-4351");
  expect(metrics.packages).toContain("fireartro-drone-show-neversea-show-img-4351");
  expect(new Set(metrics.imageOpacities).size).toBe(1);
  expect(new Set(metrics.imageFilters).size).toBe(1);
  expect(metrics.imageFilters[0]).toContain("blur");
  expect(metrics.packagesScrim).toBe(metrics.aboutScrim);
  expect(metrics.overflow).toBeLessThanOrEqual(1);

  const packages = page.getByTestId("home-packages");
  await expect(packages.getByRole("heading", { level: 2 }))
    .toHaveText("Fiecare noapte cere alt spectacol.");
  await expect(packages).not.toContainText("Alege un punct de plecare");
});

test("keeps gallery, packages, and about on one continuous atmospheric layer", async ({ page }) => {
  await page.setViewportSize({ width: 1512, height: 982 });
  await page.goto("/#acasa", { waitUntil: "domcontentloaded" });

  const state = await page.evaluate(() => {
    const home = document.querySelector(".fa-home");
    const packages = document.querySelector(".fa-packages");
    const about = document.querySelector(".fa-about");
    const aboutImage = document.querySelector(".fa-about__image");

    return {
      rootImage: getComputedStyle(home, "::before").backgroundImage,
      rootScrim: getComputedStyle(home, "::after").backgroundImage,
      localBackgrounds: [
        getComputedStyle(packages).backgroundImage,
        getComputedStyle(about).backgroundImage,
      ],
      localImages: [
        getComputedStyle(packages, "::before").backgroundImage,
        getComputedStyle(aboutImage).backgroundImage,
      ],
      localScrims: [
        getComputedStyle(packages, "::after").backgroundImage,
        getComputedStyle(document.querySelector(".fa-about__shade")).backgroundImage,
      ],
    };
  });

  expect(state.rootImage).toContain("fireartro-drone-show-neversea-show-img-4351");
  expect(state.rootScrim).toContain("linear-gradient");
  expect(state.localBackgrounds).toEqual(["none", "none"]);
  expect(state.localImages).toEqual(["none", "none"]);
  expect(state.localScrims).toEqual(["none", "none"]);
});

for (const [route, selector, asset] of [
  ["/contact", ".nr-contact-main", "fireartro-drone-show-neversea-show-img-4351.webp"],
  ["/intrebari-frecvente", ".nr-faq-route", "fireartro-drone-show-neversea-show-img-4351.webp"],
  ["/galerie", ".nr-gallery-page", "fireartro-drone-show-neversea-show-img-4351.webp"],
  ["/pachete", ".nr-packages-page", "fireartro-drone-show-neversea-show-img-4351.webp"],
]) {
  test(`${route} uses its assigned atmospheric image behind content`, async ({ page }) => {
    await page.setViewportSize({ width: 1512, height: 982 });
    await page.goto(route, { waitUntil: "domcontentloaded" });

    const state = await page.locator(selector).evaluate((node) => ({
      image: getComputedStyle(node, "::before").backgroundImage,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    }));

    expect(state.image).toContain(asset.replace(/\.webp$/, ""));
    expect(state.image).toContain(".webp");
    expect(state.overflow).toBeLessThanOrEqual(1);
  });
}

test("keeps FAQ content transparent so its atmospheric photo stays visible", async ({ page }) => {
  await page.setViewportSize({ width: 430, height: 932 });
  await page.goto("/intrebari-frecvente", { waitUntil: "domcontentloaded" });

  const state = await page.locator("main.nr-faq-page").evaluate((node) => ({
    contentBackground: getComputedStyle(node).backgroundColor,
    atmosphere: getComputedStyle(node.parentElement, "::before").backgroundImage,
  }));

  expect(state.contentBackground).toBe("rgba(0, 0, 0, 0)");
  expect(state.atmosphere).toContain("fireartro-drone-show-neversea-show-img-4351");
});
