import { expect, test } from "@playwright/test";
import { installStubs } from "./stubs";
import { THEME_KEY } from "../src/lib/theme";

/**
 * 다크 모드 토글 — docs/specs/2026-09-17-dark-mode-toggle.md
 *
 * <p>단위 테스트(`ThemeToggle.test.tsx`)는 jsdom이라 실제 CSS 캐스케이드를 타지 않는다.
 * `globals.css`의 3단 구조(`:root[data-theme]`가 미디어쿼리를 이기는지)는 실제 브라우저가
 * 렌더한 색으로만 확인된다.
 */
test.describe("다크 모드 토글", () => {
  test("AC-THEME-03 · 토글을 누르면 배경색이 실제로 바뀐다", async ({
    page,
  }) => {
    await installStubs(page);
    await page.goto("/more");

    const bg = () =>
      page.evaluate(() => getComputedStyle(document.body).backgroundColor);

    const before = await bg();
    await page.getByRole("button", { name: "다크 모드로 전환" }).click();
    const after = await bg();

    expect(after).not.toBe(before);
    await expect(
      page.getByRole("button", { name: "라이트 모드로 전환" }),
    ).toBeVisible();
  });

  test("AC-THEME-05 · 새로고침 후에도 선택이 유지된다", async ({ page }) => {
    await installStubs(page);
    await page.goto("/more");
    await page.getByRole("button", { name: "다크 모드로 전환" }).click();

    const darkBg = await page.evaluate(
      () => getComputedStyle(document.body).backgroundColor,
    );

    await page.reload();
    await page.waitForLoadState("networkidle");

    const stored = await page.evaluate(
      (key) => localStorage.getItem(key),
      THEME_KEY,
    );
    expect(stored).toBe("dark");

    // FOUC 없이 첫 페인트부터 다크여야 한다 — <head> 인라인 스크립트가 hydration 전에 심는다.
    const attr = await page.evaluate(() =>
      document.documentElement.getAttribute("data-theme"),
    );
    expect(attr).toBe("dark");

    const afterReloadBg = await page.evaluate(
      () => getComputedStyle(document.body).backgroundColor,
    );
    expect(afterReloadBg).toBe(darkBg);
  });
});
