import { expect, test } from "@playwright/test";
import { installStubs } from "./stubs";

/**
 * 웹 셸·공통 문법 — docs/specs/2026-09-27-web-shell-grammar.md
 *
 * <p>스텁 id: 레시피 상세 `/recipes/12`, 기록 상세 `/brews/2`, 프로필 `/u/11`(본인).
 */

const WEB = { width: 1280, height: 900 };

test.describe("수치 굵기", () => {
  test.use({ viewport: WEB });

  for (const path of ["/recipes", "/recipes/12", "/brews/2"]) {
    test(`AC-GRAMMAR-09 · ${path}의 수치 유틸이 500이다`, async ({ page }) => {
      await installStubs(page);
      await page.goto(path);
      const metrics = page.locator(
        ".text-metric, .text-metric-hero, .text-card-metric",
      );
      await expect(metrics.first()).toBeVisible();

      const weights = await metrics.evaluateAll((els) =>
        els.map((el) => getComputedStyle(el).fontWeight),
      );
      expect(weights.length).toBeGreaterThan(0);
      expect(weights.filter((w) => w !== "500")).toEqual([]);
    });
  }
});
