import { expect, test } from "@playwright/test";
import { SCREENS } from "./screens";
import { installStubs } from "./stubs";
import { tokenColor } from "./tokenColor";

/*
 * 갱신(2026-09-17): 타입 스케일이 Clean Ledger 6단계로 재편됐다.
 * 화면 제목 24→27 · 본문 16→15 · 라벨 14→13
 * (docs/specs/2026-09-17-design-system-v2.md 「타입 스케일」).
 */

/**
 * 읽힘 — docs/specs/2026-09-15-readability.md
 *
 * <p><b>소스 검사를 믿지 않는다.</b> 클래스가 붙어 있어도 부모가 짓누르면 크기가 달라지고,
 * 그건 렌더 측정만 잡는다. touch-targets 스위트가 같은 이유로 렌더를 잰다.
 */

test.describe("읽힘 — 렌더된 크기", () => {
  test("AC-READ-11 · 화면 제목이 27px로 렌더된다", async ({ page }) => {
    await installStubs(page);
    await page.goto("/recipes");

    const size = await page
      .locator("h1")
      .evaluate((el) => getComputedStyle(el).fontSize);

    expect(size).toBe("27px");
  });

  test("AC-READ-12 · 대표 수치가 36px로 렌더된다", async ({ page }) => {
    await installStubs(page);
    await page.goto("/recipes/12");

    // 텍스트가 아니라 data-lead로 찾는다 — 표현이 바뀌어도 깨지지 않는다(2026-09-15).
    const size = await page
      .locator("[data-lead]")
      .first()
      .evaluate((el) => getComputedStyle(el).fontSize);

    expect(size).toBe("36px");
  });

  test("AC-READ-13 · 대표 수치의 굵기가 500, 자간이 -1.44px다", async ({
    page,
  }) => {
    await installStubs(page);
    await page.goto("/recipes/12");

    const style = await page
      .locator("[data-lead]")
      .first()
      .evaluate((el) => {
        const computed = getComputedStyle(el);
        return {
          weight: computed.fontWeight,
          tracking: computed.letterSpacing,
        };
      });

    // 36px × -0.02em = -0.72px
    expect(style.weight).toBe("500");
    // 갱신(2026-09-17): 핸드오프가 metric-hero를 「Mono 36 / 500 / −4%」로 정의한다.
    // 36 × -0.04 = -1.44px.
    expect(style.tracking).toBe("-1.44px");
  });

  test("AC-READ-14 · 본문이 15px로 렌더된다", async ({ page }) => {
    await installStubs(page);
    await page.goto("/recipes/12");

    const size = await page
      .getByText("중심에서 바깥으로 나선을 그려")
      .evaluate((el) => getComputedStyle(el).fontSize);

    expect(size).toBe("15px");
  });

  test("AC-READ-15 · 라벨이 13px이고 보조색으로 렌더된다", async ({ page }) => {
    await installStubs(page);
    await page.goto("/recipes/12");

    /*
     * 갱신(2026-09-17): 「물 온도」가 히어로 판 안으로 들어가면서 색이 `on-hero-dim`이 됐다.
     * 이 조건이 보는 것은 **판 밖의 보조 라벨**이므로 대상을 CURATED 배지로 옮긴다 —
     * 어두운 판 위에서 `ink-3`를 요구하면 읽히지 않는 것을 요구하게 된다.
     */
    const style = await page
      .getByText("기본 제공", { exact: true })
      .first()
      .evaluate((el) => {
        const computed = getComputedStyle(el);
        return { size: computed.fontSize, color: computed.color };
      });

    expect(style.size).toBe("13px");
    expect(style.color).toBe(await tokenColor(page, "ink-3"));
  });
});

/**
 * 앱 코드 184곳에서 글자를 키우는 변경이다. 레이아웃이 깨지는 것이 최대 위험이고,
 * 그것은 가로 스크롤로 먼저 드러난다.
 */
test.describe("읽힘 — 회귀", () => {
  for (const { path } of SCREENS) {
    test(`AC-READ-17 · ${path}에 가로 스크롤이 없다`, async ({ page }) => {
      await installStubs(page);
      await page.goto(path);
      await page.waitForLoadState("networkidle");

      const width = await page.evaluate(
        () => document.documentElement.scrollWidth,
      );

      expect(width).toBeLessThanOrEqual(360);
    });
  }
});
