import { expect, test } from "@playwright/test";
import { installStubs } from "./stubs";

/**
 * globals.css의 토큰을 rgb()로 옮긴 값. 브라우저가 hex를 rgb로 정규화해 돌려준다.
 *
 * <p><b>소스 검사는 「금지된 것이 없다」만 본다.</b> 클래스 이름을 틀리거나 토큰이 생성되지 않으면
 * 단위 테스트는 초록인데 화면에서 색이 사라진다. 여기서만 그것을 잡는다.
 */
const BRAND_LIGHT = "rgb(111, 78, 55)";
const BRAND_DARK = "rgb(201, 169, 138)";
const ON_ACCENT_DARK = "rgb(23, 23, 23)";
const MUTED_LIGHT = "rgb(115, 115, 115)";

test.describe("시각 위계 — 라이트", () => {
  test("AC-VISUAL-14 · 주 액션 버튼이 브랜드 색이다", async ({ page }) => {
    await installStubs(page);
    await page.goto("/recipes/new");

    const save = page.getByRole("button", { name: "저장" });
    await expect(save).toBeVisible();

    expect(
      await save.evaluate((el) => getComputedStyle(el).backgroundColor),
    ).toBe(BRAND_LIGHT);
  });

  test("AC-VISUAL-15 · 화면 제목이 20px다", async ({ page }) => {
    await installStubs(page);
    await page.goto("/recipes");

    const heading = page.getByRole("heading", { level: 1 });
    await expect(heading).toBeVisible();

    expect(await heading.evaluate((el) => getComputedStyle(el).fontSize)).toBe(
      "20px",
    );
  });

  test("AC-VISUAL-16 · 카드 대표 수치가 18px다", async ({ page }) => {
    await installStubs(page);
    await page.goto("/recipes");

    // 목록 첫 카드는 hoffmannSummary다 — 30.0g → 500.0g.
    const dose = page.getByText("30.0g").first();
    await expect(dose).toBeVisible();

    expect(await dose.evaluate((el) => getComputedStyle(el).fontSize)).toBe(
      "18px",
    );
  });

  test("AC-VISUAL-17 · 보조줄이 muted 색이다", async ({ page }) => {
    await installStubs(page);
    await page.goto("/recipes");

    const ratio = page.getByText("1:16.7").first();
    await expect(ratio).toBeVisible();

    expect(await ratio.evaluate((el) => getComputedStyle(el).color)).toBe(
      MUTED_LIGHT,
    );
  });
});

test.describe("시각 위계 — 다크", () => {
  test.use({ colorScheme: "dark" });

  test("AC-VISUAL-18 · 다크에서 버튼 쌍이 뒤집힌다", async ({ page }) => {
    await installStubs(page);
    await page.goto("/recipes/new");

    const save = page.getByRole("button", { name: "저장" });
    await expect(save).toBeVisible();

    const style = await save.evaluate((el) => {
      const computed = getComputedStyle(el);
      return { background: computed.backgroundColor, color: computed.color };
    });

    expect(style.background).toBe(BRAND_DARK);
    expect(style.color).toBe(ON_ACCENT_DARK);
  });
});
