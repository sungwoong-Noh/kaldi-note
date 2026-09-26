import { expect, test, type Page } from "@playwright/test";
import { installStubs } from "./stubs";

/** docs/specs/2026-09-27-brew-form-redesign.md — 기록 작성·편집 레이아웃. */

const NEW = "/brews/new?recipeId=12";

async function open(page: Page, width: number, height = 900) {
  await installStubs(page);
  await page.setViewportSize({ width, height });
  await page.goto(NEW);
  await page.getByLabel("원두량").waitFor();
}

async function heroBox(page: Page) {
  const box = await page.locator("[data-hero]").boundingBox();
  if (box === null) throw new Error("히어로가 없다");
  return box;
}

test.describe("AC-BREWFORM-01 · 폭에 따라 미리보기 위치와 너비가 바뀐다", () => {
  for (const [width, heroWidth] of [
    [1280, 420],
    [1100, 360],
  ] as const) {
    test(`${width}px — 폼 오른쪽, 너비 ${heroWidth}px`, async ({ page }) => {
      await open(page, width);
      const hero = await heroBox(page);
      const field = await page.getByLabel("원두량").boundingBox();

      expect(Math.round(hero.width)).toBe(heroWidth);
      expect(hero.x).toBeGreaterThan(field!.x + field!.width);
    });
  }

  for (const width of [900, 390]) {
    test(`${width}px — 히어로가 폼 위`, async ({ page }) => {
      await open(page, width);
      const hero = await heroBox(page);
      const firstInput = await page
        .locator("main input, main select")
        .first()
        .boundingBox();

      expect(hero.y).toBeLessThan(firstInput!.y);
    });
  }
});

test("AC-BREWFORM-12 · 모바일에서 기록하기가 하단에 고정된다", async ({
  page,
}) => {
  await open(page, 390, 844);
  const button = await page
    .getByRole("button", { name: "기록하기" })
    .boundingBox();

  expect(button).not.toBeNull();
  // 화면 밖(아래)이면 간격이 음수가 된다 — 「24 이하」만 보면 그것도 통과해 버린다.
  const gap = 844 - (button!.y + button!.height);
  expect(gap).toBeGreaterThanOrEqual(0);
  expect(gap).toBeLessThanOrEqual(24);
});
