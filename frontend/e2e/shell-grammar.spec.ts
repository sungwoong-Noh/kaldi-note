import { expect, test } from "@playwright/test";
import { installStubs } from "./stubs";
import { tokenColor } from "./tokenColor";
import { withinTolerance } from "./tolerance";

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

test.describe("모바일 탭 바", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("AC-GRAMMAR-10 · 탭 바는 58px이고 활성 탭이 ink + 밑줄이다", async ({
    page,
  }) => {
    await installStubs(page);
    await page.goto("/recipes");
    const nav = page.locator('nav[aria-label="주요 화면"]');
    await expect(nav).toBeVisible();

    const box = await nav.evaluate((el) => {
      const s = getComputedStyle(el);
      return {
        content:
          el.getBoundingClientRect().height -
          parseFloat(s.borderTopWidth) -
          parseFloat(s.paddingBottom),
        borderTopWidth: s.borderTopWidth,
        borderTopColor: s.borderTopColor,
      };
    });
    expect(withinTolerance(box.content, 58)).toBe(true);
    expect(box.borderTopWidth).toBe("1px");
    expect(box.borderTopColor).toBe(await tokenColor(page, "divider-strong"));

    const tab = async (name: string) =>
      nav.getByRole("link", { name }).evaluate((link) => {
        const label = link.querySelector("[data-tab-label]") as HTMLElement;
        const bar = link.querySelector("[data-tab-bar]") as HTMLElement | null;
        const s = getComputedStyle(label);
        const l = label.getBoundingClientRect();
        const b = bar?.getBoundingClientRect();
        return {
          size: s.fontSize,
          weight: s.fontWeight,
          color: s.color,
          bar: b && {
            width: b.width,
            height: b.height,
            gap: b.top - l.bottom,
            color: getComputedStyle(bar as HTMLElement).backgroundColor,
          },
        };
      });

    const ink = await tokenColor(page, "ink");
    const active = await tab("레시피");
    expect(active).toMatchObject({ size: "13px", weight: "600", color: ink });
    expect(active.bar).toMatchObject({ width: 18, height: 2, color: ink });
    expect(withinTolerance(active.bar?.gap ?? -1, 8)).toBe(true);

    const inkThree = await tokenColor(page, "ink-3");
    for (const name of ["홈", "내 잔", "더보기"]) {
      expect(await tab(name)).toEqual({
        size: "13px",
        weight: "400",
        color: inkThree,
        bar: undefined,
      });
    }
  });
});

const DETAIL_BACK: [string, string][] = [
  ["/recipes/12", "/recipes"],
  ["/brews/2", "/brews"],
  ["/u/11", "/"],
  ["/gear/grind-converter", "/more"],
];

test.describe("뒤로 규칙", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  for (const [path, target] of DETAIL_BACK) {
    test(`AC-GRAMMAR-12 · ${path}은 탭 바·로고 대신 뒤로(${target})다`, async ({
      page,
    }) => {
      await installStubs(page);
      await page.goto(path);

      const back = page.getByRole("link", { name: "뒤로" });
      await expect(back).toBeVisible();
      await expect(back).toHaveAttribute("href", target);
      await expect(page.locator('nav[aria-label="주요 화면"]')).toHaveCount(0);
      await expect(page.getByText("kaldi·note")).toBeHidden();
    });
  }

  test("AC-GRAMMAR-20 · 뒤로 링크는 44×44px 이상이다", async ({ page }) => {
    await installStubs(page);
    await page.goto("/brews/2");

    const box = await page.getByRole("link", { name: "뒤로" }).boundingBox();
    expect(box?.width).toBeGreaterThanOrEqual(44);
    expect(box?.height).toBeGreaterThanOrEqual(44);
  });
});

test.describe("뒤로 경계", () => {
  test("AC-GRAMMAR-13 · 1100px은 웹, 1099px은 모바일이다", async ({ page }) => {
    await installStubs(page);

    await page.setViewportSize({ width: 1100, height: 900 });
    await page.goto("/recipes/12");
    const header = page.locator("header");
    await expect(header.getByRole("link", { name: "홈" })).toBeVisible();
    await expect(page.getByRole("link", { name: "뒤로" })).toBeHidden();

    await page.setViewportSize({ width: 1099, height: 900 });
    await expect(page.getByRole("link", { name: "뒤로" })).toBeVisible();
    await expect(header.getByRole("link", { name: "홈" })).toBeHidden();
  });
});
