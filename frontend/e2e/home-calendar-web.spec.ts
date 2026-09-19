import { expect, test } from "@playwright/test";
import { brewLogWithTds } from "../src/test/fixtures";
import { installStubs } from "./stubs";

/** 홈 달력 — 웹(docs/specs/2026-09-19-home-calendar.md). "오늘"을 2026-09-19로 고정한다. */
const TODAY = new Date("2026-09-19T01:00:00Z");

function pageOfDayLogs(content: object[]) {
  return {
    content,
    page: 0,
    size: 100,
    totalElements: content.length,
    totalPages: 1,
    hasNext: false,
  };
}

test.describe("홈 달력 — 웹", () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.setFixedTime(TODAY);
  });

  test("AC-HOMECAL-55 · 1100px에서 2컬럼이다", async ({ page }) => {
    await installStubs(page);
    await page.setViewportSize({ width: 1100, height: 900 });
    await page.goto("/");

    const column = page.getByTestId("day-column");
    await expect(column).toBeVisible();
    expect((await column.boundingBox())?.width).toBe(420);
  });

  test("AC-HOMECAL-56 · 1099px에서 1컬럼이고 셀은 웹 박스다", async ({ page }) => {
    await installStubs(page);
    await page.setViewportSize({ width: 1099, height: 900 });
    await page.goto("/");

    await expect(page.getByTestId("day-column")).toBeHidden();
    await expect(
      page.getByRole("button", { name: "9월 2일, 기록 1건" }),
    ).toContainText("Hoffmann V60");
  });

  test("AC-HOMECAL-58 · 상단 바에 6개 요소가 있다", async ({ page }) => {
    await installStubs(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");

    const header = page.locator("header");
    await expect(header.getByText("kaldi")).toBeVisible();
    await expect(header.getByRole("link", { name: "홈" })).toBeVisible();
    await expect(header.getByRole("link", { name: "레시피" })).toBeVisible();
    await expect(
      header.getByRole("link", { name: "기록", exact: true }),
    ).toBeVisible();
    await expect(header.getByRole("link", { name: "기록하기" })).toBeVisible();
    await expect(header.getByRole("link", { name: "더보기" })).toBeVisible();
    await expect(page.locator("nav[aria-label='주요 화면']")).toBeHidden();
  });

  test("AC-HOMECAL-59 · 아바타를 누르면 더보기로 간다", async ({ page }) => {
    await installStubs(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");

    await page.locator("header").getByRole("link", { name: "더보기" }).click();

    await expect(page).toHaveURL("/more");
  });

  test("AC-HOMECAL-60 · 상단 바 CTA는 레시피 선택으로 보낸다", async ({ page }) => {
    await installStubs(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");

    await page.locator("header").getByRole("link", { name: "기록하기" }).click();

    await expect(page).toHaveURL("/recipes");
  });

  test("AC-HOMECAL-61 · 우측 하단 CTA도 레시피 선택으로 보낸다", async ({ page }) => {
    await installStubs(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");

    await page
      .getByTestId("day-column")
      .getByRole("link", { name: "이 날짜로 기록 추가" })
      .click();

    await expect(page).toHaveURL("/recipes");
  });

  test("AC-HOMECAL-62 · 남의 달력 우측 CTA는 프로필로 간다", async ({ page }) => {
    await installStubs(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");

    await page.getByRole("tab", { name: /지연/ }).click();
    await page
      .getByTestId("day-column")
      .getByRole("button", { name: "지연 님 프로필 보기" })
      .click();

    await expect(page).toHaveURL("/u/12");
  });

  test("AC-HOMECAL-63 · 기록이 있는 셀에 대표 레시피명이 뜬다", async ({ page }) => {
    await installStubs(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");

    await expect(
      page.getByRole("button", { name: "9월 5일, 기록 2건" }),
    ).toContainText("Kasuya 4:6");
  });

  test("AC-HOMECAL-64 · 기록이 3건 이상이면 외 N건이 뜬다", async ({ page }) => {
    await installStubs(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");

    // homeCalendar 픽스처의 09-12는 count 4 → 외 3건.
    await expect(
      page.getByRole("button", { name: "9월 12일, 기록 4건" }),
    ).toContainText("외 3건");
  });

  test("AC-HOMECAL-65 · 기록이 1건이면 외 N건이 없다", async ({ page }) => {
    await installStubs(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");

    await expect(
      page.getByRole("button", { name: "9월 2일, 기록 1건" }),
    ).not.toContainText("외");
  });

  test("AC-HOMECAL-68 · 6주에 걸친 달도 그리드 전체 높이가 같다", async ({ page }) => {
    await installStubs(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    const before = await page.getByRole("grid").boundingBox();

    await page.getByRole("button", { name: "이전 달" }).click();
    await expect(page.getByText("2026.08")).toBeVisible();
    const after = await page.getByRole("grid").boundingBox();

    expect(after?.height).toBe(before?.height);
    await expect(page.getByTestId("calendar-row")).toHaveCount(6);
  });

  test("AC-HOMECAL-69 · 다른 달 칸은 내용 없이 배경만 있다", async ({ page }) => {
    await installStubs(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");

    const outOfMonth = page.getByTestId("calendar-out-of-month").first();
    await expect(outOfMonth).toBeEmpty();
    await expect(outOfMonth).not.toHaveJSProperty("tagName", "BUTTON");
  });

  test("AC-HOMECAL-70 · 선택된 셀에 링과 배경이 있다", async ({ page }) => {
    await installStubs(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");

    const cell = page.getByRole("button", { name: "9월 5일, 기록 2건" });
    await cell.click();

    const boxShadow = await cell.evaluate((el) => getComputedStyle(el).boxShadow);
    expect(boxShadow).toContain("inset");
  });

  test("AC-HOMECAL-71 · 웹 레일에서 선택된 사람이 채운 pill이다", async ({ page }) => {
    await installStubs(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");

    const me = page.getByRole("tab", { name: /나/ });
    expect(await me.evaluate((el) => el.className)).toContain("bg-ink");
  });

  test("AC-HOMECAL-72 · 메모가 있으면 카드에 한 줄이 뜬다", async ({ page }) => {
    await installStubs(page);
    await page.route("**/api/v1/brew-logs?*", (route) => {
      if (new URL(route.request().url()).pathname !== "/api/v1/brew-logs") {
        return route.fallback();
      }
      return route.fulfill({ json: pageOfDayLogs([brewLogWithTds]) });
    });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");

    await page.getByRole("button", { name: "9월 2일, 기록 1건" }).click();

    await expect(page.getByText("산미가 좋다")).toBeVisible();
  });

  test("AC-HOMECAL-74 · 메모가 없으면 그 줄 자체가 없다", async ({ page }) => {
    await installStubs(page);
    const withoutNote = { ...brewLogWithTds, overallNote: undefined };
    await page.route("**/api/v1/brew-logs?*", (route) => {
      if (new URL(route.request().url()).pathname !== "/api/v1/brew-logs") {
        return route.fallback();
      }
      return route.fulfill({ json: pageOfDayLogs([withoutNote]) });
    });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");

    await page.getByRole("button", { name: "9월 2일, 기록 1건" }).click();

    await expect(page.getByText("산미가 좋다")).toHaveCount(0);
  });

  test("AC-HOMECAL-77 · diagnosis는 Observation 블록으로 그대로 보인다", async ({
    page,
  }) => {
    await installStubs(page);
    await page.route("**/api/v1/brew-logs?*", (route) => {
      if (new URL(route.request().url()).pathname !== "/api/v1/brew-logs") {
        return route.fallback();
      }
      return route.fulfill({ json: pageOfDayLogs([brewLogWithTds]) });
    });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");

    await page.getByRole("button", { name: "9월 2일, 기록 1건" }).click();

    await expect(
      page.getByText(
        "추출이 부족합니다. 분쇄를 곱게 하거나 물 온도를 올리거나 추출 시간을 늘려보세요.",
      ),
    ).toBeVisible();
  });

  test("AC-HOMECAL-78 · 상단 바에 로고 심볼이 렌더된다", async ({ page }) => {
    await installStubs(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");

    await expect(page.locator("header svg")).toBeVisible();
    await expect(page.locator("header").getByText("kaldi")).toBeVisible();
  });

  test("AC-HOMECAL-79 · 우측 컬럼만 스크롤한다", async ({ page }) => {
    await installStubs(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    await page.getByRole("button", { name: "9월 12일, 기록 4건" }).click();

    const before = await page.getByRole("grid").boundingBox();
    await page
      .getByTestId("day-column")
      .evaluate((el) => el.scrollBy(0, 300));
    const after = await page.getByRole("grid").boundingBox();

    expect(after?.y).toBe(before?.y);
  });
});
