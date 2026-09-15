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

test.describe("구조 — 대표 수치", () => {
  // 36px 클래스로 찾지 않는다. 스타일이 바뀔 때마다 셀렉터가 깨진다.
  for (const path of ["/recipes", "/recipes/12"]) {
    test(`AC-STRUCT-17 · ${path}의 대표 수치가 1:비율이다`, async ({ page }) => {
      await installStubs(page);
      await page.goto(path);
      await page.waitForLoadState("networkidle");

      // sr-only 라벨이 innerText에 섞이므로 값(dd)만 읽는다.
      const text = await page.locator("[data-lead] dd").first().innerText();

      expect(text, path).toMatch(/^1:\d+\.\d$/);
      expect(text, path).not.toContain("→");
    });
  }

  for (const path of ["/brews", "/brews/2"]) {
    test(`AC-STRUCT-18 · ${path}의 대표 수치가 1:비율이다`, async ({ page }) => {
      await installStubs(page);
      await page.goto(path);
      await page.waitForLoadState("networkidle");

      // sr-only 라벨이 innerText에 섞이므로 값(dd)만 읽는다.
      const text = await page.locator("[data-lead] dd").first().innerText();

      expect(text, path).toMatch(/^1:\d+\.\d$/);
    });
  }
});

const FORMS = [
  "/recipes/new",
  "/recipes/12/edit",
  "/brews/new?recipeId=12",
  "/gear/grind-converter",
] as const;

test.describe("구조 — 폼", () => {
  for (const path of FORMS) {
    test(`AC-STRUCT-01 · ${path}의 일반 필드가 right 1종류다`, async ({
      page,
    }) => {
      await installStubs(page);
      await page.goto(path);
      await page.waitForLoadState("networkidle");

      const rights = await page.evaluate(() => {
        const out = new Set<number>();
        for (const el of document.querySelectorAll("input, select, textarea")) {
          // 스텝 행은 예외다 — 한 줄에 컨트롤 여럿이 들어간다.
          if (el.closest("[data-step-row]")) continue;
          if (el.getAttribute("type") === "checkbox") continue;
          const rect = el.getBoundingClientRect();
          if (rect.width === 0) continue;
          out.add(Math.round(rect.right));
        }
        return [...out];
      });

      expect(rights, path).toEqual([344]);
    });
  }

  test("AC-STRUCT-06 · 단위가 입력칸 안에 있다", async ({ page }) => {
    await installStubs(page);
    await page.goto("/recipes/new");
    await page.waitForLoadState("networkidle");

    const input = await page.getByLabel("원두량").boundingBox();
    const unit = await page.locator("[data-unit]").first().boundingBox();

    expect(unit!.x + unit!.width).toBeLessThan(input!.x + input!.width);
  });
});
