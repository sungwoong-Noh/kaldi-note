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

test("AC-BREWFORM-25 · 별점·5축·공개 범위 버튼은 44×44 이상", async ({
  page,
}) => {
  await open(page, 390);
  await page.getByRole("button", { name: "맛 자세히" }).click();

  const targets = [
    page.getByRole("button", { name: /^별점 [1-5]$/ }),
    page.getByRole("button", { name: /^(산미|단맛|바디|쓴맛|여운) [1-5]$/ }),
    page.getByRole("radio"),
  ];
  const counts = await Promise.all(targets.map((t) => t.count()));
  expect(counts).toEqual([5, 25, 3]);

  const small: string[] = [];
  for (const target of targets) {
    for (const el of await target.all()) {
      const box = await el.boundingBox();
      if (box === null || box.width < 44 || box.height < 44) {
        small.push(
          `${(await el.getAttribute("aria-label")) ?? (await el.textContent())}: ${box?.width}×${box?.height}`,
        );
      }
    }
  }
  expect(small).toEqual([]);
});
