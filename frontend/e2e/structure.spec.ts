import { expect, test } from "@playwright/test";
import { installStubs } from "./stubs";

/**
 * 구조와 폼 — docs/specs/2026-09-15-structure.md
 *
 * <p>폼의 폭과 타임라인 위치는 렌더 측정으로만 판정한다. 클래스가 붙어 있어도 부모가 짓누르면
 * 좌표가 달라진다 — touch-targets·readability가 같은 이유로 렌더를 쟀다.
 */

/** 화면에 남아 있으면 안 되는 백엔드 enum 값. */
const ENUM_WORDS = [
  "IDEAL",
  "UNDER",
  "OVER",
  "WEAK",
  "STRONG",
  "TOO_FRESH",
  "PAST_PEAK",
  "CURATED",
];

test.describe("구조 — 상태값", () => {
  for (const path of ["/brews/2", "/recipes", "/recipes/12"]) {
    test(`AC-STRUCT-14 · ${path}에 영어 상태값이 없다`, async ({ page }) => {
      await installStubs(page);
      await page.goto(path);
      await page.waitForLoadState("networkidle");

      const text = await page.locator("body").innerText();

      for (const word of ENUM_WORDS) {
        expect(text, `${path}에 ${word}가 남아 있다`).not.toContain(word);
      }
    });
  }

  test("AC-STRUCT-16 · CURATED가 「기본 제공」으로 렌더된다", async ({
    page,
  }) => {
    await installStubs(page);
    await page.goto("/recipes");
    await page.waitForLoadState("networkidle");

    // 픽스처 레시피 2건이 모두 CURATED다.
    await expect(page.getByText("기본 제공")).toHaveCount(2);
  });
});
