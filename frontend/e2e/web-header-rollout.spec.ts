import { expect, test } from "@playwright/test";
import { installStubs } from "./stubs";

const TARGET_PAGES = [
  "/recipes",
  "/recipes/12",
  "/brews",
  "/brews/2",
  "/more",
  "/gear/grind-converter",
];

const EXCLUDED_PAGES = [
  "/login",
  "/recipes/new",
  "/brews/new?recipeId=12",
  "/recipes/12/edit",
  "/brews/2/edit",
];

test.describe("웹 헤더 롤아웃", () => {
  for (const path of TARGET_PAGES) {
    test(`AC-WEBHDR-01 · ${path}에 로고 헤더가 보인다(<1100px)`, async ({
      page,
    }) => {
      await installStubs(page);
      await page.goto(path);

      const header = page.locator("header");
      await expect(header.locator("svg")).toBeVisible();
      await expect(header.getByText("kaldi")).toBeVisible();
    });
  }

  test("AC-WEBHDR-02 · <1100px에서는 네비·CTA·아바타가 없다", async ({
    page,
  }) => {
    await installStubs(page);
    await page.goto("/recipes");

    const header = page.locator("header");
    await expect(header.getByRole("link", { name: "홈" })).toBeHidden();
    await expect(header.getByRole("link", { name: "기록하기" })).toBeHidden();
    await expect(header.getByRole("link", { name: "더보기" })).toBeHidden();
  });

  test("AC-WEBHDR-03 · ≥1100px에서는 네비·CTA·아바타가 모두 보인다", async ({
    page,
  }) => {
    await installStubs(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/recipes");

    const header = page.locator("header");
    await expect(header.getByRole("link", { name: "홈" })).toBeVisible();
    await expect(header.getByRole("link", { name: "레시피" })).toBeVisible();
    await expect(
      header.getByRole("link", { name: "기록", exact: true }),
    ).toBeVisible();
    const cta = header.getByRole("link", { name: "기록하기" });
    await expect(cta).toBeVisible();
    await expect(cta).toHaveAttribute("href", "/recipes");
    await expect(header.getByRole("link", { name: "더보기" })).toBeVisible();
  });

  test("AC-WEBHDR-04 · /recipes에서는 「레시피」만 감전다", async ({
    page,
  }) => {
    await installStubs(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/recipes");

    const header = page.locator("header");
    await expect(header.getByRole("link", { name: "레시피" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(header.getByRole("link", { name: "홈" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  test("AC-WEBHDR-05 · /brews에서는 「기록」이 감전다", async ({ page }) => {
    await installStubs(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/brews");

    const header = page.locator("header");
    await expect(
      header.getByRole("link", { name: "기록", exact: true }),
    ).toHaveAttribute("aria-current", "page");
  });

  test("AC-WEBHDR-08 · 1100px은 전체 헤더 쪽이다", async ({ page }) => {
    await installStubs(page);
    await page.setViewportSize({ width: 1100, height: 900 });
    await page.goto("/recipes");

    await expect(
      page.locator("header").getByRole("link", { name: "레시피" }),
    ).toBeVisible();
  });

  test("AC-WEBHDR-09 · 1099px은 로고만 보이는 쪽이다", async ({ page }) => {
    await installStubs(page);
    await page.setViewportSize({ width: 1099, height: 900 });
    await page.goto("/recipes");

    const header = page.locator("header");
    await expect(header.locator("svg")).toBeVisible();
    await expect(header.getByRole("link", { name: "레시피" })).toBeHidden();
  });

  for (const path of EXCLUDED_PAGES) {
    test(`AC-WEBHDR-10 · ${path}에는 헤더가 없다`, async ({ page }) => {
      await installStubs(page);
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto(path);

      await expect(page.locator("header")).toHaveCount(0);
    });
  }
});
