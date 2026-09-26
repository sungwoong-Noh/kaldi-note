import { expect, test } from "@playwright/test";
import { installStubs } from "./stubs";

/** `gridTemplateColumns`의 공백 구분 값 개수 = 실제 렌더된 열 수. */
async function gridColumnCount(
  page: import("@playwright/test").Page,
): Promise<number> {
  const grid = page.locator("ul.grid").first();
  const template = await grid.evaluate(
    (el) => getComputedStyle(el).gridTemplateColumns,
  );
  return template.split(" ").filter((v) => v !== "").length;
}

test.describe("레시피 그리드 반응형 4구간", () => {
  test("AC-RECIPESBREWS-88 · 1280px에서 4열이다", async ({ page }) => {
    await installStubs(page);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/recipes?scope=PUBLIC");

    expect(await gridColumnCount(page)).toBe(4);
  });

  test("AC-RECIPESBREWS-89 · 1279px에서 3열이다", async ({ page }) => {
    await installStubs(page);
    await page.setViewportSize({ width: 1279, height: 900 });
    await page.goto("/recipes?scope=PUBLIC");

    expect(await gridColumnCount(page)).toBe(3);
  });

  test("AC-RECIPESBREWS-90 · 1024px에서 3열이다", async ({ page }) => {
    await installStubs(page);
    await page.setViewportSize({ width: 1024, height: 900 });
    await page.goto("/recipes?scope=PUBLIC");

    expect(await gridColumnCount(page)).toBe(3);
  });

  test("AC-RECIPESBREWS-91 · 1023px에서 레시피 그리드가 2열이다", async ({
    page,
  }) => {
    await installStubs(page);
    await page.setViewportSize({ width: 1023, height: 900 });
    await page.goto("/recipes?scope=PUBLIC");

    expect(await gridColumnCount(page)).toBe(2);
  });

  test("AC-RECIPESBREWS-91 · 1023px에서 내 잔 테이블은 수율 열이 숨는다", async ({
    page,
  }) => {
    await installStubs(page);
    await page.setViewportSize({ width: 1023, height: 900 });
    await page.goto("/brews");

    await expect(
      page.getByRole("columnheader", { name: "수율" }),
    ).toBeHidden();
  });

  test("AC-RECIPESBREWS-92 · 760px에서 2열이다", async ({ page }) => {
    await installStubs(page);
    await page.setViewportSize({ width: 760, height: 900 });
    await page.goto("/recipes?scope=PUBLIC");

    expect(await gridColumnCount(page)).toBe(2);
  });

  test("AC-RECIPESBREWS-93 · 759px에서 1열·바텀시트다", async ({ page }) => {
    await installStubs(page);
    await page.setViewportSize({ width: 759, height: 900 });
    await page.goto("/recipes?scope=PUBLIC");

    expect(await gridColumnCount(page)).toBe(1);
    await expect(page.getByRole("button", { name: "필터" })).toBeVisible();
  });

  test("AC-RECIPESBREWS-93 · 759px에서 내 잔은 2줄 원장 행이다", async ({
    page,
  }) => {
    await installStubs(page);
    await page.setViewportSize({ width: 759, height: 900 });
    await page.goto("/brews");

    await expect(page.locator("table")).toHaveCount(0);
    // brewLogPage 픽스처의 두 항목 다 recipeId 12(stubs.ts는 hoffmann으로 해석한다) —
    // 같은 이름이 두 번 뜬다.
    await expect(
      page.getByText("James Hoffmann Ultimate V60").first(),
    ).toBeVisible({ timeout: 10000 });
  });
});
