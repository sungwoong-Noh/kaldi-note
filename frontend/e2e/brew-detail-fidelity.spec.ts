import { expect, test, type Page } from "@playwright/test";
import { installStubs, installSwStubs } from "./stubs";

/** docs/specs/2026-10-11-brew-detail-fidelity.md — 기록 상세 W3·B2 정합. */

const DETAIL = "/brews/2";

async function open(page: Page, width: number, height = 900) {
  await installSwStubs(page.context());
  await installStubs(page);
  await page.setViewportSize({ width, height });
  await page.goto(DETAIL);
  await page.locator("[data-lead]").waitFor();
}

async function box(page: Page, selector: string) {
  const b = await page.locator(selector).first().boundingBox();
  if (b === null) throw new Error(`${selector}가 없다`);
  return b;
}

test.describe("AC-BDETAIL-01 · 웹은 2컬럼, 모바일은 1컬럼이다", () => {
  for (const [width, asideWidth] of [
    [1280, 420],
    [1100, 360],
  ] as const) {
    test(`${width}px — 오른쪽 칼럼 ${asideWidth}px`, async ({ page }) => {
      await open(page, width);
      const aside = await box(page, "[data-detail-aside]");
      const main = await box(page, "[data-detail-main]");

      expect(Math.round(aside.width)).toBe(asideWidth);
      expect(aside.x).toBeGreaterThan(main.x + main.width - 1);
    });
  }

  test("1099px — 오른쪽 칼럼이 없다", async ({ page }) => {
    await open(page, 1099);
    await expect(page.locator("[data-detail-aside]")).toHaveCount(0);
  });
});

test("AC-BDETAIL-11 · 웹 동작은 상단 바에 있다", async ({ page }) => {
  await open(page, 1280);
  const banner = page.getByRole("banner");
  const main = page.getByRole("main");

  await expect(banner.getByRole("link", { name: "다시 내리기" })).toHaveAttribute(
    "href",
    "/brews/new?recipeId=12",
  );
  await expect(banner.getByRole("link", { name: "수정" })).toHaveAttribute(
    "href",
    "/brews/2/edit",
  );
  await expect(banner.getByRole("button", { name: "삭제" })).toBeVisible();
  await expect(main.getByRole("link", { name: "다시 내리기" })).toHaveCount(0);
  await expect(main.getByRole("link", { name: "수정" })).toHaveCount(0);
  await expect(main.getByRole("button", { name: "삭제" })).toHaveCount(0);
});

test.describe("AC-BDETAIL-20 · 가로 스크롤이 없다", () => {
  for (const width of [390, 1099, 1100, 1280]) {
    test(`${width}px`, async ({ page }) => {
      await open(page, width);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }
});
