import { expect, test } from "@playwright/test";
import { brewLogWithTds } from "../src/test/fixtures";
import { installStubs } from "./stubs";
import { tokenColor } from "./tokenColor";

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

  test("AC-HOMECAL-122 · 우측 컬럼 padding이 좌우 48px, 배경이 surface다", async ({
    page,
  }) => {
    await installStubs(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");

    const column = page.getByTestId("day-column");
    const style = await column.evaluate((el) => {
      const s = getComputedStyle(el);
      return { pl: s.paddingLeft, pr: s.paddingRight, bg: s.backgroundColor };
    });
    const surface = await page.evaluate(() => {
      const probe = document.createElement("span");
      probe.style.color = "var(--surface)";
      document.body.appendChild(probe);
      const v = getComputedStyle(probe).color;
      probe.remove();
      return v;
    });

    expect(style.pl).toBe("48px");
    expect(style.pr).toBe("48px");
    expect(style.bg).toBe(surface);
  });

  test("AC-HOMECAL-84 · 1440px에서 달력 그리드가 Shell의 max-w-2xl에 눌리지 않는다", async ({
    page,
  }) => {
    await installStubs(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");

    const grid = page.getByRole("grid");
    const width = (await grid.boundingBox())?.width ?? 0;
    expect(width).toBeGreaterThan(900);
  });

  test("AC-HOMECAL-56 · 1099px에서 1컬럼이고 셀은 웹 박스다", async ({
    page,
  }) => {
    await installStubs(page);
    await page.setViewportSize({ width: 1099, height: 900 });
    await page.goto("/");

    await expect(page.getByTestId("day-column")).toBeHidden();
    await expect(
      page.getByRole("button", { name: "9월 2일, 기록 1건" }),
    ).toContainText("Hoffmann V60");
  });

  test("AC-HOMECAL-58 · AC-HOMECAL-83 · 상단 바에 6개 요소가 있다", async ({
    page,
  }) => {
    await installStubs(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");

    const header = page.locator("header");
    await expect(header.getByText("kaldi")).toBeVisible();
    await expect(header.getByRole("link", { name: "홈" })).toBeVisible();
    await expect(header.getByRole("link", { name: "레시피", exact: true })).toBeVisible();
    await expect(
      header.getByRole("link", { name: "기록", exact: true }),
    ).toBeVisible();
    await expect(header.getByRole("link", { name: "이 레시피로 내렸다" })).toBeVisible();
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

  test("AC-HOMECAL-60 · 상단 바 CTA는 레시피 선택으로 보낸다", async ({
    page,
  }) => {
    await installStubs(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");

    await page
      .locator("header")
      .getByRole("link", { name: "이 레시피로 내렸다" })
      .click();

    await expect(page).toHaveURL("/recipes");
  });

  test("AC-HOMECAL-61 · 우측 하단 CTA도 레시피 선택으로 보낸다", async ({
    page,
  }) => {
    await installStubs(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");

    await page
      .getByTestId("day-column")
      .getByRole("link", { name: "이 날짜로 기록 추가" })
      .click();

    await expect(page).toHaveURL("/recipes");
  });

  test("AC-HOMECAL-62 · 남의 달력 우측 CTA는 프로필로 간다", async ({
    page,
  }) => {
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

  test("AC-HOMECAL-63 · 기록이 있는 셀에 대표 레시피명이 뜬다", async ({
    page,
  }) => {
    await installStubs(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");

    await expect(
      page.getByRole("button", { name: "9월 5일, 기록 2건" }),
    ).toContainText("Kasuya 4:6");
  });

  test("AC-HOMECAL-64 · 기록이 3건 이상이면 외 N건이 뜬다", async ({
    page,
  }) => {
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

  test("AC-HOMECAL-68 · 6주에 걸친 달도 그리드 전체 높이가 같다", async ({
    page,
  }) => {
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

  test("AC-HOMECAL-69 · 다른 달 칸은 내용 없이 배경만 있다", async ({
    page,
  }) => {
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

    const boxShadow = await cell.evaluate(
      (el) => getComputedStyle(el).boxShadow,
    );
    expect(boxShadow).toContain("inset");
  });

  test("AC-HOMECAL-71 · 웹 레일에서 선택된 사람이 채운 pill이다", async ({
    page,
  }) => {
    await installStubs(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");

    const me = page.getByRole("tab", { name: /나/ });
    expect(await me.evaluate((el) => el.className)).toContain("bg-ink");
  });

  test("AC-HOMECAL-72 · 메모가 있으면 카드에 한 줄이 뜬다", async ({
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
    await page.getByTestId("day-column").evaluate((el) => el.scrollBy(0, 300));
    const after = await page.getByRole("grid").boundingBox();

    expect(after?.y).toBe(before?.y);
  });

  test("AC-HOMECAL-85 · ≥1100px에서 그리드가 남는 세로 공간을 채운다", async ({
    page,
  }) => {
    await installStubs(page);

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    const shortGrid = await page
      .getByTestId("calendar-week-grid")
      .boundingBox();

    await page.setViewportSize({ width: 1440, height: 1100 });
    await page.goto("/");
    const tallGrid = await page.getByTestId("calendar-week-grid").boundingBox();

    expect(shortGrid?.height).not.toBe(420);
    expect(tallGrid?.height).not.toBe(shortGrid?.height);
  });

  test("AC-HOMECAL-86 · 행 높이가 64px 밑으로 내려가야 하면 페이지가 스크롤된다", async ({
    page,
  }) => {
    await installStubs(page);
    await page.setViewportSize({ width: 1440, height: 500 });
    await page.goto("/");

    await page.getByRole("button", { name: "이전 달" }).click();
    await expect(page.getByText("2026.08")).toBeVisible();

    const rows = page.getByTestId("calendar-row");
    await expect(rows).toHaveCount(6);
    // 500px는 그리드 6행이 64px 바닥에 정확히 눌리는 높이다(사전 실측: 그리드 밖 크롬이
    // 약 249px). 70px(옛 420px 고정값 ÷ 6)이 아니라 정확히 64px이어야 새 바닥 로직이
    // 동작한다는 걸 증명한다 — `toBeGreaterThanOrEqual(64)`만으로는 옛 구현도 우연히
    // 통과해 버려 이 테스트가 아무것도 증명하지 못한다.
    const firstRowHeight = await rows
      .first()
      .evaluate((el) => el.getBoundingClientRect().height);
    expect(firstRowHeight).toBe(64);

    const scrollHeight = await page.evaluate(
      () => document.documentElement.scrollHeight,
    );
    const innerHeight = await page.evaluate(() => window.innerHeight);
    expect(scrollHeight).toBeGreaterThan(innerHeight);
  });

  test("AC-HOMECAL-91 · 1099px(1컬럼)에서는 이 반응형 채움을 쓰지 않는다", async ({
    page,
  }) => {
    await installStubs(page);

    await page.setViewportSize({ width: 1099, height: 700 });
    await page.goto("/");
    const short = await page.getByTestId("calendar-week-grid").boundingBox();

    await page.setViewportSize({ width: 1099, height: 1200 });
    await page.goto("/");
    const tall = await page.getByTestId("calendar-week-grid").boundingBox();

    expect(short?.height).toBe(tall?.height);
  });

  test("AC-HOMECAL-87 · 그리드선 — 상단은 divider-strong, 내부는 sunken, 폭 1px", async ({
    page,
  }) => {
    await installStubs(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");

    const grid = page.getByTestId("calendar-week-grid");
    const topWidth = await grid.evaluate(
      (el) => getComputedStyle(el).borderTopWidth,
    );
    const topColor = await grid.evaluate(
      (el) => getComputedStyle(el).borderTopColor,
    );
    expect(topWidth).toBe("1px");
    expect(topColor).toBe(await tokenColor(page, "divider-strong"));

    const secondRow = page.getByTestId("calendar-row").nth(1);
    const innerWidth = await secondRow.evaluate(
      (el) => getComputedStyle(el).borderTopWidth,
    );
    const innerColor = await secondRow.evaluate(
      (el) => getComputedStyle(el).borderTopColor,
    );
    expect(innerWidth).toBe("1px");
    expect(innerColor).toBe(await tokenColor(page, "sunken"));
  });

  test("AC-HOMECAL-88 · 셀 안쪽 여백이 상하 8px·좌우 12px다", async ({
    page,
  }) => {
    await installStubs(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");

    const cell = page.getByRole("button", { name: "9월 5일, 기록 2건" });
    const padding = await cell.evaluate((el) => {
      const s = getComputedStyle(el);
      return {
        top: s.paddingTop,
        bottom: s.paddingBottom,
        left: s.paddingLeft,
        right: s.paddingRight,
      };
    });
    expect(padding).toEqual({
      top: "8px",
      bottom: "8px",
      left: "12px",
      right: "12px",
    });
  });

  test("AC-HOMECAL-89 · 선택된 날짜 숫자가 24px 원으로 감싸진다", async ({
    page,
  }) => {
    await installStubs(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");

    const cell = page.getByRole("button", { name: "9월 5일, 기록 2건" });
    await cell.click();
    const numberEl = cell.getByTestId("day-number");

    const box = await numberEl.boundingBox();
    expect(Math.round(box?.width ?? 0)).toBe(24);
    expect(Math.round(box?.height ?? 0)).toBe(24);

    // Tailwind의 `rounded-full`은 큰 px 값(예: `3.35544e+07px`)으로 계산된다 — 정확한 숫자가
    // 아니라 박스 절반(12px)보다 훨씬 커서 완전한 원이 되는지만 확인한다.
    const borderRadius = await numberEl.evaluate(
      (el) => getComputedStyle(el).borderRadius,
    );
    const bg = await numberEl.evaluate(
      (el) => getComputedStyle(el).backgroundColor,
    );
    const color = await numberEl.evaluate((el) => getComputedStyle(el).color);
    expect(parseFloat(borderRadius)).toBeGreaterThan(12);
    expect(bg).toBe(await tokenColor(page, "ink"));
    expect(color).toBe(await tokenColor(page, "on-ink"));
  });

  test("AC-HOMECAL-90 · 오늘이지만 선택 안 된 날짜 숫자에 1px 링이 있다", async ({
    page,
  }) => {
    await installStubs(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");

    // 진입 시 오늘(9/19)이 자동 선택되므로, 다른 날짜를 선택해 오늘을 비선택 상태로 만든다.
    await page.getByRole("button", { name: "9월 5일, 기록 2건" }).click();

    const todayCell = page.getByRole("button", { name: "9월 19일, 기록 없음" });
    const numberEl = todayCell.getByTestId("day-number");

    const borderWidth = await numberEl.evaluate(
      (el) => getComputedStyle(el).borderTopWidth,
    );
    const borderColor = await numberEl.evaluate(
      (el) => getComputedStyle(el).borderTopColor,
    );
    const bg = await numberEl.evaluate(
      (el) => getComputedStyle(el).backgroundColor,
    );

    expect(borderWidth).toBe("1px");
    expect(borderColor).toBe(await tokenColor(page, "border"));
    expect(bg).toBe("rgba(0, 0, 0, 0)");
  });
});
