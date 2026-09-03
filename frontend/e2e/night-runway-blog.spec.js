const { test, expect } = require("@playwright/test");

const posts = [
  {
    id: "post-3",
    slug: "articol-nou",
    title: "Articol nou",
    excerpt: "Rezumat nou",
    body: "Primul paragraf.\n\n<script>alert(1)</script>",
    category: "Noutăți",
    cover_media_id: "",
    cover_alt: "",
    status: "published",
    created_at: "2026-08-30T10:00:00+00:00",
    updated_at: "2026-08-30T10:00:00+00:00",
    published_at: "2026-08-30T10:00:00+00:00",
  },
  {
    id: "post-2",
    slug: "articol-doi",
    title: "Articol doi",
    excerpt: "Rezumat doi",
    body: "Conținut doi.",
    category: "Culise",
    cover_media_id: "",
    cover_alt: "",
    status: "published",
    created_at: "2026-08-20T10:00:00+00:00",
    updated_at: "2026-08-20T10:00:00+00:00",
    published_at: "2026-08-20T10:00:00+00:00",
  },
  {
    id: "post-1",
    slug: "articol-unu",
    title: "Articol unu",
    excerpt: "Rezumat unu",
    body: "Conținut unu.",
    category: "Evenimente",
    cover_media_id: "",
    cover_alt: "",
    status: "published",
    created_at: "2026-08-10T10:00:00+00:00",
    updated_at: "2026-08-10T10:00:00+00:00",
    published_at: "2026-08-10T10:00:00+00:00",
  },
];

async function mockBlog(page, items = posts) {
  await page.route("**/api/blog/posts**", async (route) => {
    const url = new URL(route.request().url());
    const slug = url.pathname.split("/api/blog/posts/")[1];
    if (slug) {
      const post = items.find((item) => item.slug === decodeURIComponent(slug));
      await route.fulfill({
        status: post ? 200 : 404,
        contentType: "application/json",
        body: JSON.stringify(
          post || { detail: "Articolul nu a fost găsit." },
        ),
      });
      return;
    }
    const limit = Number(url.searchParams.get("limit") || items.length);
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(items.slice(0, limit)),
    });
  });
}

test("landing renders the newest three and links to the complete Blog", async ({ page }) => {
  await mockBlog(page);
  await page.goto("/", { waitUntil: "domcontentloaded" });

  const section = page.getByTestId("home-blog");
  await expect(section).toBeVisible();
  await expect(section.getByTestId("blog-card")).toHaveCount(3);
  await expect(
    section.getByTestId("blog-card").locator("h3"),
  ).toHaveText(["Articol nou", "Articol doi", "Articol unu"]);
  await expect(section.locator("time")).toHaveCount(3);
  await expect(section.locator("time").first()).toHaveAttribute(
    "datetime",
    posts[0].published_at,
  );
  await expect(
    section.getByRole("link", { name: "Vezi tot blogul" }),
  ).toHaveAttribute("href", "/blog");
});

test("landing hides the Blog section for empty or failed requests", async ({ page }) => {
  await mockBlog(page, []);
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("home-blog")).toHaveCount(0);

  await page.unroute("**/api/blog/posts**");
  await page.route("**/api/blog/posts**", (route) => route.abort("failed"));
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("home-blog")).toHaveCount(0);
});

test("archive, safe article body, and footer navigation use approved routes", async ({ page }) => {
  await mockBlog(page);
  await page.goto("/blog", { waitUntil: "domcontentloaded" });

  await expect(page.getByRole("heading", { name: "Blog", exact: true })).toBeVisible();
  await expect(page.getByTestId("blog-card")).toHaveCount(3);
  await expect(
    page.getByTestId("night-runway-footer").getByRole(
      "link",
      { name: "Blog", exact: true },
    ),
  ).toHaveAttribute("href", "/blog");

  await page.getByTestId("blog-card").first().getByRole("link").first().click();
  await expect(page).toHaveURL(/\/blog\/articol-nou$/);
  await expect(page.getByTestId("blog-body").locator("p")).toHaveCount(2);
  await expect(page.getByTestId("blog-body").locator("script")).toHaveCount(0);
  await expect(page.getByTestId("blog-body")).toContainText(
    "<script>alert(1)</script>",
  );
});

test("archive distinguishes empty and failed requests", async ({ page }) => {
  await mockBlog(page, []);
  await page.goto("/blog", { waitUntil: "domcontentloaded" });
  await expect(
    page.getByText("Nu există articole publicate momentan."),
  ).toBeVisible();

  await page.unroute("**/api/blog/posts**");
  await page.route("**/api/blog/posts**", (route) => route.abort("failed"));
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("button", { name: "Încearcă din nou" }),
  ).toBeVisible();
});

test("missing article offers an accessible route back to the Blog", async ({ page }) => {
  await mockBlog(page, []);
  await page.goto("/blog/articol-inexistent", { waitUntil: "domcontentloaded" });

  await expect(page.getByText("Articolul nu a fost găsit.")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Înapoi la Blog" }),
  ).toHaveAttribute("href", "/blog");
});

test("public Blog keeps its editorial hierarchy and accessible targets across viewports", async ({ page }) => {
  await mockBlog(page);

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const homeLayout = await page.getByTestId("home-blog").evaluate((section) => {
    const grid = section.querySelector(".fa-home-blog__grid");
    const link = section.querySelector(".fa-blog-card__link");
    const styles = window.getComputedStyle(grid);
    return {
      display: styles.display,
      columns: styles.gridTemplateColumns.split(" ").filter(Boolean).length,
      linkHeight: link.getBoundingClientRect().height,
      overflow: document.documentElement.scrollWidth - window.innerWidth,
    };
  });
  expect(homeLayout.display).toBe("grid");
  expect(homeLayout.columns).toBeGreaterThanOrEqual(2);
  expect(homeLayout.linkHeight).toBeGreaterThanOrEqual(44);
  expect(homeLayout.overflow).toBeLessThanOrEqual(1);

  for (const viewport of [
    { width: 430, height: 932 },
    { width: 844, height: 390 },
    { width: 568, height: 320 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/blog", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("blog-card").first()).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
    const cardLinkHeight = await page
      .getByTestId("blog-card")
      .first()
      .locator(".fa-blog-card__link")
      .evaluate((element) => element.getBoundingClientRect().height);
    expect(cardLinkHeight).toBeGreaterThanOrEqual(44);
  }

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/blog/articol-nou", { waitUntil: "domcontentloaded" });
  const articleWidth = await page.locator(".fa-blog-article").evaluate(
    (article) => article.getBoundingClientRect().width,
  );
  expect(articleWidth).toBeLessThanOrEqual(900);
});

test("Blog motion is restrained and honors reduced-motion preferences", async ({ page }) => {
  await mockBlog(page);
  await page.goto("/", { waitUntil: "domcontentloaded" });

  const normalDuration = await page.getByTestId("blog-card").first().evaluate(
    (card) => Number.parseFloat(window.getComputedStyle(card).transitionDuration) || 0,
  );
  expect(normalDuration).toBeGreaterThan(0);

  await page.emulateMedia({ reducedMotion: "reduce" });
  const reducedDuration = await page.getByTestId("blog-card").first().evaluate(
    (card) => Number.parseFloat(window.getComputedStyle(card).transitionDuration) || 0,
  );
  expect(reducedDuration).toBeLessThanOrEqual(0.001);
});

test("Blog surfaces use the approved compact scale", async ({ page }) => {
  await mockBlog(page);
  await page.setViewportSize({ width: 1920, height: 1080 });

  await page.goto("/", { waitUntil: "domcontentloaded" });
  const landing = await page.getByTestId("home-blog").evaluate((section) => {
    const heading = section.querySelector("h2");
    const lead = section.querySelector(".fa-blog-card.is-lead");
    const styles = window.getComputedStyle(section);
    return {
      headingSize: Number.parseFloat(window.getComputedStyle(heading).fontSize),
      paddingTop: Number.parseFloat(styles.paddingTop),
      leadHeight: lead.getBoundingClientRect().height,
    };
  });
  expect(landing.headingSize).toBeLessThanOrEqual(56);
  expect(landing.paddingTop).toBeLessThanOrEqual(88);
  expect(landing.leadHeight).toBeLessThanOrEqual(400);

  await page.goto("/blog", { waitUntil: "domcontentloaded" });
  const archive = await page.locator(".fa-blog-hero").evaluate((hero) => ({
    height: hero.getBoundingClientRect().height,
    titleSize: Number.parseFloat(
      window.getComputedStyle(hero.querySelector("h1")).fontSize,
    ),
  }));
  expect(archive.height).toBeLessThanOrEqual(360);
  expect(archive.titleSize).toBeLessThanOrEqual(88);
  await expect(page.getByTestId("blog-card").first()).toBeInViewport();

  await page.goto("/blog/articol-nou", { waitUntil: "domcontentloaded" });
  const articleTitleSize = await page.locator(".fa-blog-article h1").evaluate(
    (heading) => Number.parseFloat(window.getComputedStyle(heading).fontSize),
  );
  expect(articleTitleSize).toBeLessThanOrEqual(56);

  await page.setViewportSize({ width: 430, height: 932 });
  await page.goto("/blog", { waitUntil: "domcontentloaded" });
  const mobileTitleSize = await page.locator(".fa-blog-hero h1").evaluate(
    (heading) => Number.parseFloat(window.getComputedStyle(heading).fontSize),
  );
  expect(mobileTitleSize).toBeLessThanOrEqual(52);
  expect(await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  )).toBeLessThanOrEqual(1);
});

test("admin creates a draft, uploads its cover, publishes it, and deletes it", async ({ page }) => {
  const adminKey = "valid-admin-key";
  let storedPosts = [];

  await page.route("**/api/admin/blog/media", async (route) => {
    expect(route.request().headers()["x-admin-key"]).toBe(adminKey);
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({ id: "media-cover-1" }),
    });
  });

  await page.route("**/api/admin/blog/posts**", async (route) => {
    const request = route.request();
    expect(request.headers()["x-admin-key"]).toBe(adminKey);
    const method = request.method();
    const url = new URL(request.url());
    const postId = url.pathname.split("/api/admin/blog/posts/")[1];

    if (method === "GET") {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify(storedPosts),
      });
      return;
    }

    if (method === "POST") {
      const payload = request.postDataJSON();
      const created = {
        ...payload,
        id: "post-created-1",
        slug: "primul-articol",
        status: "draft",
        created_at: "2026-08-30T10:00:00+00:00",
        updated_at: "2026-08-30T10:00:00+00:00",
        published_at: null,
      };
      storedPosts = [created];
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify(created),
      });
      return;
    }

    if (method === "PUT") {
      const payload = request.postDataJSON();
      storedPosts = storedPosts.map((post) => (
        post.id === postId
          ? {
              ...post,
              ...payload,
              published_at: payload.status === "published"
                ? "2026-08-30T11:00:00+00:00"
                : post.published_at,
            }
          : post
      ));
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify(storedPosts.find((post) => post.id === postId)),
      });
      return;
    }

    if (method === "DELETE") {
      storedPosts = storedPosts.filter((post) => post.id !== postId);
      await route.fulfill({ status: 204, body: "" });
    }
  });

  await page.goto("/admin", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: /Blog/ }).click();
  await page.getByLabel("Cheie Admin").fill(adminKey);
  await page.getByRole("button", { name: "Accesează Blogul" }).click();
  await expect(page.getByText("Nu există articole. Creează primul articol.")).toBeVisible();

  await page.getByRole("button", { name: "Articol nou" }).click();
  await page.getByLabel("Titlu").fill("Primul articol");
  await page.getByLabel("Descriere scurtă").fill("Un rezumat public.");
  await page.getByLabel("Conținut").fill("Primul paragraf.\n\nAl doilea paragraf.");
  await page.getByLabel("Categorie").fill("Noutăți");
  await page.getByLabel("Text alternativ").fill("Artificii albastre pe cer");
  await page.getByLabel("Imagine de copertă").setInputFiles(
    "public/media/fireart-hero-poster.webp",
  );
  await expect(page.getByText(/Imaginea a fost încărcată/)).toBeVisible();

  const published = page.getByLabel("Publicat");
  await expect(published).toBeDisabled();
  await page.getByRole("button", { name: "Salvează articolul" }).click();
  await expect(page.getByText("Draft salvat.")).toBeVisible();
  await expect(page.getByRole("code")).toHaveText("primul-articol");

  await expect(published).toBeEnabled();
  await published.check();
  await page.getByRole("button", { name: "Salvează articolul" }).click();
  await expect(page.getByText("Articol publicat.")).toBeVisible();

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Șterge articolul" }).click();
  await expect(page.getByText("Nu există articole. Creează primul articol.")).toBeVisible();
});
