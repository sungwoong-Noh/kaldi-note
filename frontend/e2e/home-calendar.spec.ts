import { expect, test } from "@playwright/test";
import {
  brewLogPage,
  grindedRecipe,
  homeCalendar,
} from "../src/test/fixtures";
import { installStubs, stubRecipeDetail } from "./stubs";

/** brewLogPage.content[0]에서 id·brewedAt만 덜어쓴 것 — 지어내지 않고 실제 응답 모양을 쓴다. */
function singleDayLog(id: number, brewedAt: string) {
  return {
    ...brewLogPage.content[0],
    id,
    brewedAt,
  };
}

/**
 * 홈 달력 — 모바일(docs/specs/2026-09-19-home-calendar.md).
 *
 * <p>"오늘"을 `page.clock`으로 고정한다. 실행 시각이 바뀌어도 `homeCalendar` 픽스처의
 * 2026-09 날짜들과 어긋나지 않는다.
 */
const TODAY = new Date("2026-09-19T01:00:00Z");

test.describe("홈 달력 — 모바일", () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.setFixedTime(TODAY);
  });

  test("AC-HOMECAL-30 · 기록이 1건인 날을 눌러도 상세로 이동하지 않는다", async ({
    page,
  }) => {
    await installStubs(page);
    await page.route("**/api/v1/brew-logs*", (route) => {
      // 정확히 /brew-logs(쿼리 유무 무관)만 가로챈다 — /brew-logs/7(단건 상세)까지 잡으면
      // AC-HOMECAL-31에서 상세 화면이 이 응답으로 잘못 그려진다.
      if (new URL(route.request().url()).pathname !== "/api/v1/brew-logs") {
        return route.fallback();
      }
      return route.fulfill({
        json: {
          content: [singleDayLog(7, "2026-09-02T01:00:00Z")],
          page: 0,
          size: 100,
          totalElements: 1,
          totalPages: 1,
          hasNext: false,
        },
      });
    });
    await page.goto("/");

    await page.getByRole("button", { name: "9월 2일, 기록 1건" }).click();

    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByTestId("day-list-row")).toHaveCount(1);
  });

  test("AC-HOMECAL-31 · 목록 행을 누르면 상세로 간다", async ({ page }) => {
    await installStubs(page);
    await page.route("**/api/v1/brew-logs*", (route) => {
      // 정확히 /brew-logs(쿼리 유무 무관)만 가로챈다 — /brew-logs/7(단건 상세)까지 잡으면
      // AC-HOMECAL-31에서 상세 화면이 이 응답으로 잘못 그려진다.
      if (new URL(route.request().url()).pathname !== "/api/v1/brew-logs") {
        return route.fallback();
      }
      return route.fulfill({
        json: {
          content: [singleDayLog(7, "2026-09-02T01:00:00Z")],
          page: 0,
          size: 100,
          totalElements: 1,
          totalPages: 1,
          hasNext: false,
        },
      });
    });
    await page.goto("/");
    await page.getByRole("button", { name: "9월 2일, 기록 1건" }).click();

    await page.getByTestId("day-list-row").click();

    await expect(page).toHaveURL("/brews/7");
  });

  test("AC-HOMECAL-34 · 오른쪽으로 스와이프하면 이전 달로 넘어간다", async ({
    page,
  }) => {
    // 왼쪽 스와이프는 다음 달 방향이라, "오늘"이 속한 이번 달에서는 막혀 있다
    // (미래 달 금지). 뒤로는 항상 열려 있어 오른쪽 스와이프로 검증한다.
    await installStubs(page);
    await page.goto("/");
    await expect(page.getByText("2026.09")).toBeVisible();

    const grid = page.getByRole("grid");
    const box = await grid.boundingBox();
    if (box === null) throw new Error("grid의 bounding box를 읽지 못했다");
    const y = box.y + box.height / 2;

    await page.mouse.move(box.x + 20, y);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width - 20, y, { steps: 5 });
    await page.mouse.up();

    await expect(page.getByText("2026.08")).toBeVisible();
  });

  test("AC-HOMECAL-48 · 모바일 하단 CTA는 레시피 선택으로 보낸다", async ({
    page,
  }) => {
    await installStubs(page);
    await page.goto("/");

    await page.getByRole("link", { name: "이 레시피로 내렸다" }).click();

    await expect(page).toHaveURL("/recipes");
  });

  test("AC-HOMECAL-49 · 기록을 저장하고 돌아오면 점이 찍혀 있다", async ({
    page,
    context,
  }) => {
    await installStubs(page);
    // 홈에 아직 기록이 없는 날짜다(homeCalendar 픽스처에 없다).
    await page.goto("/");
    await expect(
      page.getByRole("button", { name: "9월 8일, 기록 없음" }),
    ).toBeVisible();

    // 캘린더 홈은 recipeId 없이 작성 화면을 열 수 없다 — 실제 흐름처럼 레시피를 정해 연다
    // (docs/specs/2026-09-19-home-calendar.md 「구현 중 정정」).
    //
    // 레시피 상세는 Service Worker가 네트워크 우선 캐시로 가로챈다 — page.route로는 못 잡고
    // context.route로만 잡힌다(stubs.ts의 installSwStubs 주석 참조). stubRecipeDetail이 그
    // 경로를 쓴다.
    await stubRecipeDetail(context, grindedRecipe);
    let created = false;
    await page.route("**/api/v1/brew-logs/calendar*", (route) =>
      route.fulfill({
        json: created
          ? {
              ...homeCalendar,
              totalCount: homeCalendar.totalCount + 1,
              days: [
                ...homeCalendar.days,
                {
                  date: "2026-09-08",
                  count: 1,
                  primaryRecipeName: "분쇄도 있는 레시피",
                },
              ],
            }
          : homeCalendar,
      }),
    );
    await page.route("**/api/v1/brew-logs", (route) => {
      if (route.request().method() !== "POST") return route.fallback();
      created = true;
      return route.fulfill({
        status: 201,
        json: singleDayLog(99, "2026-09-08T01:00:00Z"),
      });
    });

    await page.goto("/brews/new?recipeId=16");
    // 원두는 원장 행의 「변경」 → 고르기 다이얼로그에서 고른다(docs/specs/2026-09-27-brew-form-redesign.md).
    await page.getByRole("button", { name: "원두 변경" }).click();
    await page
      .getByRole("dialog", { name: "원두 고르기" })
      .getByRole("button", { name: /예가체프/ })
      .first()
      .click();
    await page.getByRole("button", { name: "기록하기" }).click();

    await expect(page).toHaveURL("/brews/99");
    await page.getByRole("link", { name: "홈" }).click();

    await expect(
      page.getByRole("button", { name: "9월 8일, 기록 1건" }),
    ).toBeVisible();
  });

  test("AC-HOMECAL-51 · 기록이 4건인 날에도 달력 위치가 변하지 않는다", async ({
    page,
  }) => {
    await installStubs(page);
    await page.goto("/");
    await page.getByRole("button", { name: "9월 2일, 기록 1건" }).click();
    const before = await page.getByRole("grid").boundingBox();

    await page.getByRole("button", { name: "9월 12일, 기록 4건" }).click();
    const after = await page.getByRole("grid").boundingBox();

    expect(after?.y).toBe(before?.y);
  });

  test("AC-HOMECAL-57 · 759px에서 모바일 레이아웃이다", async ({ page }) => {
    await page.setViewportSize({ width: 759, height: 900 });
    await installStubs(page);
    await page.goto("/");

    const cell = page.getByRole("button", { name: "9월 2일, 기록 1건" });
    await expect(cell).not.toContainText("Hoffmann V60");
    // 하단 탭바로 좁힌다 — 2026-09-20부터 상단 로고 헤더의 "홈" 네비게이션 링크도
    // (숨겨진 채로) DOM에 함께 있어 이름만으로 찾으면 두 개가 잡힌다.
    await expect(
      page
        .locator("nav[aria-label='주요 화면']")
        .getByRole("link", { name: "홈" }),
    ).toBeVisible();
  });
});

test.describe("홈 달력 — 모바일 헤더", () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.setFixedTime(TODAY);
  });

  test("AC-HOMECAL-80 · 1100px 미만에서도 로고 헤더가 보인다", async ({
    page,
  }) => {
    await installStubs(page);
    await page.goto("/");

    const header = page.locator("header");
    await expect(header.locator("svg")).toBeVisible();
    await expect(header.getByText("kaldi")).toBeVisible();
  });

  test("AC-HOMECAL-81 · 그 헤더에는 네비게이션 링크가 없다", async ({
    page,
  }) => {
    await installStubs(page);
    await page.goto("/");

    const header = page.locator("header");
    await expect(header.getByRole("link", { name: "홈" })).toBeHidden();
    await expect(header.getByRole("link", { name: "레시피" })).toBeHidden();
    await expect(
      header.getByRole("link", { name: "내 잔", exact: true }),
    ).toBeHidden();
  });

  test("AC-HOMECAL-82 · 그 헤더에는 CTA와 아바타가 없다", async ({ page }) => {
    await installStubs(page);
    await page.goto("/");

    const header = page.locator("header");
    await expect(
      header.getByRole("link", { name: "이 레시피로 내렸다" }),
    ).toBeHidden();
    await expect(header.getByRole("link", { name: "더보기" })).toBeHidden();
  });
});

/**
 * 모바일 선택/오늘 날짜 표시 — 버그 수정. `docs/design/design_handoff_kaldi_note/
 * HOME-CALENDAR.md`는 모바일도 "선택된 날: 28px ink 원", "오늘·미선택: 28px 1px border 링"을
 * 요구하지만, 2026-09-19 home-calendar 스펙에는 `aria-current`(a11y)만 AC로 남고 시각적
 * 표시 AC가 빠져 있었다 — 실제로 모바일에는 표시가 전혀 없었다.
 */
test.describe("홈 달력 — 모바일 선택/오늘 표시", () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.setFixedTime(TODAY);
  });

  test("선택된 날짜 숫자가 28px ink 원으로 감싸진다", async ({ page }) => {
    await installStubs(page);
    await page.goto("/");

    const cell = page.getByRole("button", { name: "9월 5일, 기록 2건" });
    await cell.click();
    const numberEl = cell.getByTestId("day-number");

    const box = await numberEl.boundingBox();
    expect(Math.round(box?.width ?? 0)).toBe(28);
    expect(Math.round(box?.height ?? 0)).toBe(28);
  });

  test("오늘이지만 선택 안 된 날짜 숫자에 1px 링이 있다", async ({ page }) => {
    await installStubs(page);
    await page.goto("/");

    // 진입 시 오늘(9/19)이 자동 선택되므로, 다른 날짜를 선택해 오늘을 비선택 상태로 만든다.
    await page.getByRole("button", { name: "9월 5일, 기록 2건" }).click();

    const todayCell = page.getByRole("button", { name: "9월 19일, 기록 없음" });
    const numberEl = todayCell.getByTestId("day-number");

    const borderWidth = await numberEl.evaluate(
      (el) => getComputedStyle(el).borderTopWidth,
    );
    const bg = await numberEl.evaluate(
      (el) => getComputedStyle(el).backgroundColor,
    );

    expect(borderWidth).toBe("1px");
    expect(bg).toBe("rgba(0, 0, 0, 0)");
  });
});

/**
 * 모바일 스크롤 고정 — 버그 수정. `docs/design/design_handoff_kaldi_note/HOME-CALENDAR.md`의
 * 「스크롤 정책」은 "화면 전체가 아니라 날짜별 목록 영역만 세로 스크롤한다. 헤더·레일·달력·CTA·
 * 탭바는 고정"이라고 못박았지만, 실제로는 이 정책이 웹 2컬럼(`day-column`, AC-HOMECAL-79)에만
 * 구현돼 있고 모바일에는 전혀 없었다 — 날짜별 목록이 길어지면 페이지 전체가 스크롤되며
 * 달력·헤더가 함께 밀려 올라갔다.
 */
test.describe("홈 달력 — 모바일 스크롤 고정", () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.setFixedTime(TODAY);
  });

  test("날짜별 목록만 스크롤되고 달력은 고정된다", async ({ page }) => {
    await installStubs(page);
    await page.route("**/api/v1/brew-logs*", (route) => {
      if (new URL(route.request().url()).pathname !== "/api/v1/brew-logs") {
        return route.fallback();
      }
      const content = Array.from({ length: 10 }, (_, i) => ({
        ...brewLogPage.content[0],
        id: 100 + i,
      }));
      return route.fulfill({
        json: {
          content,
          page: 0,
          size: 100,
          totalElements: content.length,
          totalPages: 1,
          hasNext: false,
        },
      });
    });
    await page.goto("/");
    await page.getByRole("button", { name: "9월 2일, 기록 1건" }).click();

    const before = await page.getByRole("grid").boundingBox();
    await page.getByTestId("day-scroll").evaluate((el) => el.scrollBy(0, 300));
    const after = await page.getByRole("grid").boundingBox();

    expect(after?.y).toBe(before?.y);
  });

  test("AC-HOMECAL-128 · 짧은 목록이어도 날짜별 목록 영역이 뷰포트 60%를 넘지 않는다", async ({
    page,
  }) => {
    await installStubs(page);
    await page.goto("/");
    await page.getByRole("button", { name: "9월 5일, 기록 2건" }).click();

    const viewport = page.viewportSize();
    const box = await page.getByTestId("day-scroll").boundingBox();

    expect(box!.height).toBeLessThanOrEqual(viewport!.height * 0.6 + 1);
  });

  test("AC-HOMECAL-128 · 긴 목록은 상한 안에서 계속 내부 스크롤된다", async ({
    page,
  }) => {
    await installStubs(page);
    await page.route("**/api/v1/brew-logs*", (route) => {
      if (new URL(route.request().url()).pathname !== "/api/v1/brew-logs") {
        return route.fallback();
      }
      const content = Array.from({ length: 10 }, (_, i) => ({
        ...brewLogPage.content[0],
        id: 200 + i,
      }));
      return route.fulfill({
        json: {
          content,
          page: 0,
          size: 100,
          totalElements: content.length,
          totalPages: 1,
          hasNext: false,
        },
      });
    });
    await page.goto("/");
    await page.getByRole("button", { name: "9월 2일, 기록 1건" }).click();

    const viewport = page.viewportSize();
    const dayScroll = page.getByTestId("day-scroll");
    const box = await dayScroll.boundingBox();

    expect(box!.height).toBeLessThanOrEqual(viewport!.height * 0.6 + 1);
    const scrollHeight = await dayScroll.evaluate((el) => el.scrollHeight);
    expect(scrollHeight).toBeGreaterThan(box!.height);
  });
});

/**
 * 팔로우 레일 아바타 크기 고정 — 버그 수정. 웹 pill(`FollowRail.tsx`의 `RailTab` web 분기)의
 * 버튼은 `min-w-11` 같은 최소 너비 보호가 없다 — 모바일 분기와 달리 `flex items-center gap-2`
 * 뿐이다. 맞팔로우가 많아 `role="tablist"` 행(`overflow-x-auto`)이 넘치면, 사진 없는 아바타의
 * 이니셜 `<span>`(비대체 요소, 자동 최소 크기가 텍스트 min-content로 작다)이 32px 밑으로
 * 찌그러든다. 실측: 20명일 때 32px → 약 21.5~22.2px.
 */
test.describe("홈 달력 — 팔로우 레일 아바타 크기(웹)", () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.setFixedTime(TODAY);
  });

  test("맞팔로우가 많아도 32px로 찌그러지지 않는다", async ({ page }) => {
    await installStubs(page);
    // installStubs 뒤에 등록해야 한다 — Playwright는 나중에 등록한 route가 먼저 매칭되므로,
    // 여기서 먼저 걸면 installStubs의 기본 mutualFollows 핸들러에 가려진다.
    await page.route("**/api/v1/users/me/mutual-follows", (route) =>
      route.fulfill({
        json: Array.from({ length: 20 }, (_, i) => ({
          id: 100 + i,
          nickname: `친구${i}`,
        })),
      }),
    );
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    await expect(page.getByRole("tab", { name: /친구19/ })).toBeVisible();

    const widths = await page
      .locator('[role="tablist"] span[style*="32px"]')
      .evaluateAll((els) => els.map((el) => el.getBoundingClientRect().width));

    expect(widths.length).toBeGreaterThan(10);
    for (const width of widths) {
      expect(Math.round(width)).toBe(32);
    }
  });
});
