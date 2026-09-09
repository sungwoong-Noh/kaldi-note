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

test.describe("터치 타깃 — 예외", () => {
  /**
   * 예외는 **산문·제목 안의 링크**다. 글줄에 녹아 있어 높이를 강제하면 줄간격이 무너진다.
   *
   * <p><b>경로마다 테스트를 나눈다.</b> 한 테스트 안에서 여러 경로를 연속 이동하면 두 번째부터
   * 데이터가 붙지 않아 링크가 아예 안 그려진다 — 그러면 「예외가 0개」라는 거짓 초록이 된다.
   */
  const EXPECTED: Record<string, number> = {
    "/": 0,
    "/recipes": 0,
    "/recipes/12": 1, // <p> 안의 출처 링크 James Hoffmann
    "/brews": 0,
    "/brews/2": 1, // <h1> 안의 레시피 제목
    "/more": 0,
  };

  for (const [path, expected] of Object.entries(EXPECTED)) {
    test(`AC-TOUCH-03 · ${path}의 예외가 ${expected}개다`, async ({ page }) => {
      await installStubs(page);
      await page.goto(path);
      await page.waitForLoadState("networkidle");

      // 브라우저 네이티브 querySelectorAll을 쓴다. 스윕과 **같은 엔진**이어야 판정이 갈리지 않는다.
      const count = await page.evaluate(
        () =>
          document.querySelectorAll(":is(p, h1, h2, h3, h4, h5, h6) a").length,
      );

      expect(count).toBe(expected);
    });
  }
});
