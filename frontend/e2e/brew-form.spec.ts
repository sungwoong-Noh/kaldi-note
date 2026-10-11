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

test.describe("AC-BREWFORM-24 · 가로 스크롤이 없다", () => {
  for (const path of [NEW, "/brews/2/edit"]) {
    for (const width of [390, 1024, 1280]) {
      test(`${path} — ${width}px`, async ({ page }) => {
        await installStubs(page);
        await page.setViewportSize({ width, height: 900 });
        await page.goto(path);
        await page.getByLabel("원두량").waitFor();

        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - window.innerWidth,
        );
        expect(overflow).toBeLessThanOrEqual(0);
      });
    }
  }
});
