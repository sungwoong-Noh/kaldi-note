import { expect, test, type Page } from "@playwright/test";
import { installStubs } from "./stubs";

/** docs/specs/2026-10-21-recipe-edit-redesign.md — 레시피 작성·편집 목업 03 정합. */

const NEW = "/recipes/new";
/** 스텁의 레시피 3(kasuyaRecipe)은 `me`(11) 소유다 — 편집 폼이 열린다. */
const EDIT = "/recipes/3/edit";

async function open(page: Page, width: number, path = NEW, height = 900) {
  await installStubs(page);
  await page.setViewportSize({ width, height });
  await page.goto(path);
  await page.getByLabel("제목").waitFor();
}

test("AC-RECIPEEDIT-10 · 웹은 상단 바에 취소·저장이 있다", async ({ page }) => {
  await open(page, 1440);
  const banner = page.getByRole("banner");

  await expect(
    banner.getByRole("button", { name: "레시피 저장", exact: true }),
  ).toBeVisible();
  await expect(banner.getByRole("button", { name: "취소" })).toBeVisible();
});

test("AC-RECIPEEDIT-10 · 편집은 상단 바에 「변경 사항 저장」", async ({
  page,
}) => {
  await open(page, 1440, EDIT);
  await expect(
    page.getByRole("banner").getByRole("button", { name: "변경 사항 저장" }),
  ).toBeVisible();
});

test.describe("AC-RECIPEEDIT-80 · 웹 미리보기 폭", () => {
  for (const [width, expected] of [
    [1440, 420],
    [1280, 420],
    [1100, 360],
  ] as const) {
    test(`${width}px → ${expected}px`, async ({ page }) => {
      await open(page, width);
      const preview = await page.locator("[data-recipe-preview]").boundingBox();
      const title = await page.getByLabel("제목").boundingBox();

      expect(Math.abs(preview!.width - expected)).toBeLessThanOrEqual(1);
      expect(preview!.x).toBeGreaterThanOrEqual(title!.x + title!.width);
    });
  }
});

test.describe("AC-RECIPEEDIT-81 · 좁은 폭에는 미리보기 열이 없다", () => {
  test("900px — 히어로가 폼 위, 접힌 타임라인", async ({ page }) => {
    await open(page, 900, EDIT);

    await expect(page.locator("[data-recipe-preview]")).toHaveCount(0);
    const hero = await page.locator("[data-hero]").boundingBox();
    const title = await page.getByLabel("제목").boundingBox();
    expect(hero!.y + hero!.height).toBeLessThanOrEqual(title!.y);
    await expect(page.locator("[data-timeline-toggle]")).toBeVisible();
  });

  test("390px — 타임라인 없음", async ({ page }) => {
    await open(page, 390, EDIT, 844);

    await expect(page.locator("[data-recipe-preview]")).toHaveCount(0);
    await expect(page.locator("[data-timeline-toggle]")).toBeHidden();
  });
});

test("AC-RECIPEEDIT-82 · 모바일 하단 고정 저장이 스크롤 전후 화면 아래에 붙어 있다", async ({
  page,
}) => {
  await open(page, 390, NEW, 844);
  const save = page.getByRole("button", { name: "레시피 저장", exact: true });

  for (const scroll of [0, 10_000]) {
    await page.evaluate((y) => window.scrollTo(0, y), scroll);
    const b = await save.boundingBox();
    const gap = 844 - (b!.y + b!.height);
    expect(gap, `scrollY=${scroll}`).toBeGreaterThanOrEqual(0);
    expect(gap, `scrollY=${scroll}`).toBeLessThanOrEqual(24);
  }
});
