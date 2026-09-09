import { expect, test } from "@playwright/test";
import { TOUCH_TARGET_PX } from "../src/test/touchTarget";
import { installStubs } from "./stubs";

/**
 * 터치 타깃 44×44px.
 *
 * <p><b>소스 검사를 쓰지 않는다.</b> 클래스가 붙어 있어도 부모가 짓누르면 44px가 안 되고,
 * 그건 렌더 측정만 잡는다.
 */

test.describe("터치 타깃 — 입력 요소", () => {
  test("AC-TOUCH-08 · 「원두량」 입력칸의 높이가 44px다", async ({ page }) => {
    await installStubs(page);
    await page.goto("/brews/new?recipeId=12");

    const box = await page.getByLabel("원두량").boundingBox();

    expect(box?.height).toBe(TOUCH_TARGET_PX);
  });

  test("AC-TOUCH-09 · 「공개 범위」 select의 높이가 44px다", async ({ page }) => {
    await installStubs(page);
    // 공개 범위는 BrewLogEditor(편집)에만 있다. 작성 폼(/brews/new)에는 없다.
    await page.goto("/brews/2/edit");

    const box = await page.getByLabel("공개 범위").boundingBox();

    expect(box?.height).toBe(TOUCH_TARGET_PX);
  });
});
