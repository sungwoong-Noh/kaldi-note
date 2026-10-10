import { expect, test } from "@playwright/test";
import { SCREENS } from "./screens";
import { installStubs } from "./stubs";

/**
 * 앱 코드 184곳에서 글자를 키우는 변경이다. 레이아웃이 깨지는 것이 최대 위험이고,
 * 그것은 가로 스크롤로 먼저 드러난다.
 */
test.describe("읽힘 — 회귀", () => {
  for (const { path } of SCREENS) {
    test(`AC-READ-17 · ${path}에 가로 스크롤이 없다`, async ({ page }) => {
      await installStubs(page);
      await page.goto(path);
      await page.waitForLoadState("networkidle");

      const width = await page.evaluate(
        () => document.documentElement.scrollWidth,
      );

      expect(width).toBeLessThanOrEqual(360);
    });
  }
});
