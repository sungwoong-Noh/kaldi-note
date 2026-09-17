import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import type { Page, Route } from "@playwright/test";
import { installStubs } from "./stubs";
import { brewLogPage, hoffmann } from "../src/test/fixtures";

/**
 * 기대 스택을 **`globals.css`에서 읽는다.** 브라우저가 따옴표를 정규화하므로 이름 단위로 순서를 본다.
 *
 * <p>갱신(2026-09-17): 목록을 여기 베껴 적고 있었다. 서체가 IBM Plex로 바뀌자 이 상수만
 * 옛 값으로 남아 깨졌다 — 검사하려던 것은 「어떤 폰트인가」가 아니라
 * **「globals.css가 정한 스택이 body에 실제로 적용되는가」**다.
 */
const FONT_STACK = readFileSync(join("src", "app", "globals.css"), "utf8")
  .match(/--font-sans:\s*([^;]+);/)?.[1]
  .split(",")
  .map((name) => name.trim().replace(/^["']|["']$/g, ""))
  .filter((name) => name.length > 0) as string[];

test.describe("폰트", () => {
  test("AC-POLISH-01 · 지정한 폰트 스택이 적용된다", async ({ page }) => {
    await installStubs(page);
    await page.goto("/recipes");

    const family = await page.evaluate(
      () => getComputedStyle(document.body).fontFamily,
    );
    const names = family
      .split(",")
      .map((n) => n.trim().replace(/^["']|["']$/g, ""));
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

/** 응답을 늦춘다. installStubs 뒤에 걸어야 이긴다. */
async function delay(page: Page, pattern: string, ms: number, body: unknown) {
  await page.route(pattern, async (route: Route) => {
    await new Promise((resolve) => setTimeout(resolve, ms));
    await route.fulfill({ json: body });
  });
}

test.describe("로딩 표시", () => {
  test("AC-POLISH-08 · 홈에서 느린 응답이면 뜬다", async ({ page }) => {
    await installStubs(page);
    await delay(page, "**/api/v1/brew-logs*", 1500, brewLogPage);

    await page.goto("/");

    await expect(
      page.getByRole("status", { name: "불러오는 중" }),
    ).toBeVisible();
  });

  test("AC-POLISH-09 · 레시피 상세에서 느린 응답이면 뜬다", async ({
    page,
  }) => {
    await installStubs(page);
    await delay(page, "**/api/v1/recipes/2", 1500, hoffmann);

    await page.goto("/recipes/2");

    await expect(
      page.getByRole("status", { name: "불러오는 중" }),
    ).toBeVisible();
  });
});

test.describe("파비콘", () => {
  test("AC-POLISH-11 · /icon.svg가 열린다", async ({ request }) => {
    const response = await request.get("/icon.svg");
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("image/svg+xml");
  });

  test("AC-POLISH-12 · 문서가 파비콘을 가리킨다", async ({ page }) => {
    await installStubs(page);
    await page.goto("/recipes");
    await expect(page.locator('link[rel="icon"]')).toHaveCount(1);
  });
});
