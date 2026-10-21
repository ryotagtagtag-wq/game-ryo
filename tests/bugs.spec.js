const { test, expect } = require("@playwright/test");

const BASE_URL = "http://localhost:3000";

test.describe("Homepage Bugs", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForLoadState("networkidle");
  });

  test("i18n language switch works", async ({ page }) => {
    // Check initial Japanese
    const aboutTitle = page.locator('[data-i18n="about_title"]');
    await expect(aboutTitle).toHaveText("自己紹介");

    // Click EN button
    const enBtn = page.locator('.lang-btn[data-lang="en"]');
    await enBtn.click();

    // Check English translation
    await expect(aboutTitle).toHaveText("About Me");

    // Check persistence - reload and check EN is still active
    await page.reload();
    await expect(page.locator('.lang-btn[data-lang="en"]')).toHaveClass(
      /active/,
    );
    await expect(aboutTitle).toHaveText("About Me");
  });

  test("Self-intro text displays (not empty)", async ({ page }) => {
    const aboutText = page.locator('[data-i18n="about_text"]');
    await expect(aboutText).not.toBeEmpty();
    await expect(aboutText).toContainText("パソコン");
  });

  test("SSH Chat section appears only once", async ({ page }) => {
    const sshTitles = page.locator(
      '[data-i18n="activity_ssh_title"], [data-i18n="ssh_title"]',
    );
    const count = await sshTitles.count();
    expect(count).toBe(1); // Should only appear once
  });

  test("Sponsor section is visible and styled", async ({ page }) => {
    const sponsorLabel = page.locator('[data-i18n="sponsor_label"]');
    await expect(sponsorLabel).toBeVisible();

    // Check sponsor widget container exists
    const sponsorWidget = page.locator(".sponsor-widget");
    await expect(sponsorWidget).toBeVisible();
  });

  test("Navigation links work", async ({ page }) => {
    // Test blog link
    await page.click('[data-i18n="nav_blog"]');
    await expect(page).toHaveURL(/.*blog/);

    // Test home link
    await page.click('[data-i18n="nav_home"]');
    await expect(page).toHaveURL(BASE_URL + "/");
  });

  test("Main content and header are centered", async ({ page }) => {
    const content = await page.locator("main > .container").boundingBox();
    const header = await page.locator(".header > .container").boundingBox();

    expect(content).not.toBeNull();
    expect(header).not.toBeNull();
    expect(Math.abs(content.x + content.width / 2 - 640)).toBeLessThanOrEqual(
      1,
    );
    expect(Math.abs(header.x + header.width / 2 - 640)).toBeLessThanOrEqual(1);
  });

  test("Footer copyright displays", async ({ page }) => {
    const footer = page.locator(".footer");
    await expect(footer).toBeVisible();
    await expect(page.locator('[data-i18n="footer_text"]')).toContainText(
      "© 2026 game_ryo",
    );
  });
});

test.describe("Blog Page Bugs", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL + "/blog/");
    await page.waitForLoadState("networkidle");
  });

  test("Blog page loads with articles", async ({ page }) => {
    const blogTitle = page.locator('[data-i18n="blog_header"]');
    await expect(blogTitle).toBeVisible();

    // Check articles exist
    const articles = page.locator(".blog-card");
    const count = await articles.count();
    expect(count).toBeGreaterThan(0);
  });

  test("Blog excerpts display text without HTML markup", async ({ page }) => {
    const excerpts = page.locator(".blog-excerpt");
    await expect(excerpts.first()).not.toBeEmpty();
    await expect(excerpts).not.toContainText(/<\/?(?:figure|img|h[1-6]|p)\b/i);
  });

  test("Blog pagination hidden when fewer articles than page size", async ({
    page,
  }) => {
    // With only 3 articles and page size 10, pagination should NOT show
    const pagination = page.locator(".pagination");
    await expect(pagination).toHaveCount(0);
  });
});

test.describe("Article Page Bugs", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL + "/blog/articles/w62t0zsc3ji/");
    await page.waitForLoadState("networkidle");
  });

  test("Article page loads", async ({ page }) => {
    await expect(page.locator("article")).toBeVisible();
  });

  test("TOC sidebar appears", async ({ page }) => {
    const toc = page.locator("#toc-sidebar");
    await expect(toc).toBeVisible();
  });

  test("Scroll progress bar exists", async ({ page }) => {
    const progress = page.locator("#scroll-progress");
    await expect(progress).toBeAttached();
  });
});

test.describe("404 Page", () => {
  test("404 page shows correct message", async ({ page }) => {
    await page.goto(BASE_URL + "/nonexistent-page/");
    await expect(page.locator('[data-i18n="error_title"]')).toContainText(
      "ページが見つかりません",
    );
  });
});

test.describe("Visual Regression", () => {
  test("Homepage screenshot", async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForLoadState("networkidle");
    await page.screenshot({
      path: "tests/screenshots/homepage.png",
      fullPage: true,
    });
  });
});
