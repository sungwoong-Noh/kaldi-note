import { expect, test } from "@playwright/test";
import { installStubs } from "./stubs";

/** 브라우저가 따옴표를 정규화하므로 이름 단위로 순서를 본다. */
const FONT_STACK = [
  "system-ui",
  "-apple-system",
  "Segoe UI",
  "Roboto",
  "Apple SD Gothic Neo",
  "Noto Sans KR",
  "Malgun Gothic",
  "sans-serif",
];

test.describe("폰트", () => {
  test("AC-POLISH-01 · 지정한 폰트 스택이 적용된다", async ({ page }) => {
    await installStubs(page);
    await page.goto("/recipes");

    const family = await page.evaluate(
      () => getComputedStyle(document.body).fontFamily,
    );
    const names = family.split(",").map((n) => n.trim().replace(/^["']|["']$/g, ""));
    expect(names).toEqual(FONT_STACK);
  });

  test("AC-POLISH-02 · 숫자가 자릿수 정렬된다", async ({ page }) => {
    await installStubs(page);
    await page.goto("/recipes");

    const variant = await page.evaluate(
      () => getComputedStyle(document.body).fontVariantNumeric,
    );
    expect(variant).toBe("tabular-nums");
  });
});
