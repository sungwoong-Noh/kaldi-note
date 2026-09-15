import { expect, test } from "@playwright/test";
import { SCREENS } from "./screens";
import { installStubs } from "./stubs";

/**
 * 읽힘 — docs/specs/2026-09-15-readability.md
 *
 * <p><b>소스 검사를 믿지 않는다.</b> 클래스가 붙어 있어도 부모가 짓누르면 크기가 달라지고,
 * 그건 렌더 측정만 잡는다. touch-targets 스위트가 같은 이유로 렌더를 잰다.
 */

test.describe("읽힘 — 렌더된 크기", () => {
  test("AC-READ-11 · 화면 제목이 24px로 렌더된다", async ({ page }) => {
    await installStubs(page);
    await page.goto("/recipes");

    const size = await page
      .locator("h1")
      .evaluate((el) => getComputedStyle(el).fontSize);

    expect(size).toBe("24px");
  });

  test("AC-READ-12 · 대표 수치가 36px로 렌더된다", async ({ page }) => {
    await installStubs(page);
    await page.goto("/recipes/12");

    const size = await page
      .getByText("30.0g", { exact: true })
      .evaluate((el) => getComputedStyle(el).fontSize);

    expect(size).toBe("36px");
  });

  test("AC-READ-13 · 대표 수치의 굵기가 600, 자간이 -0.72px다", async ({
    page,
  }) => {
    await installStubs(page);
    await page.goto("/recipes/12");

    const style = await page
      .getByText("30.0g", { exact: true })
      .evaluate((el) => {
        const computed = getComputedStyle(el);
        return {
          weight: computed.fontWeight,
          tracking: computed.letterSpacing,
        };
      });

    // 36px × -0.02em = -0.72px
    expect(style.weight).toBe("600");
    expect(style.tracking).toBe("-0.72px");
  });

  test("AC-READ-14 · 본문이 16px로 렌더된다", async ({ page }) => {
    await installStubs(page);
    await page.goto("/recipes/12");

    const size = await page
      .getByText("중심에서 바깥으로 나선을 그려")
      .evaluate((el) => getComputedStyle(el).fontSize);

    expect(size).toBe("16px");
  });

  test("AC-READ-15 · 라벨이 14px이고 보조색으로 렌더된다", async ({ page }) => {
    await installStubs(page);
    await page.goto("/recipes/12");

    const style = await page
      .getByText("비율", { exact: true })
      .evaluate((el) => {
        const computed = getComputedStyle(el);
        return { size: computed.fontSize, color: computed.color };
      });

    expect(style.size).toBe("14px");
    expect(style.color).toBe("rgb(84, 84, 84)");
  });
});
