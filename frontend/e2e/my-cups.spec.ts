import { expect, test, type Page } from "@playwright/test";
import { brewLogPage, brewLogWithTds } from "../src/test/fixtures";
import { installStubs } from "./stubs";

/**
 * 「기록」 탭 (`/brews`) — docs/specs/2026-11-14-quick-brew.md (시안 F1 · F2 · FW).
 *
 * 승계 `AC-MYCUPS-12·23`과 신규 `AC-QUICKBREW-31·35·36·37`을 실제 브라우저 배치와
 * 스크롤·요청 기록으로 검증한다.
 */

const MOBILE = { width: 390, height: 844 } as const;
const TABLET = { width: 900, height: 900 } as const;
const WEB = { width: 1440, height: 900 } as const;

function makePageOf(
  content: object[],
  overrides: { totalElements?: number; hasNext?: boolean } = {},
) {
  return {
    ...brewLogPage,
    content,
    page: 0,
    size: 20,
    totalElements: overrides.totalElements ?? content.length,
    totalPages: 1,
    hasNext: overrides.hasNext ?? false,
  };
}

function calendarDaysFor2026Nov() {
  return {
    month: "2026-11",
    totalCount: 12,
    days: [
      { date: "2026-11-01", count: 1, primaryRecipeName: "James Hoffmann Ultimate V60" },
      { date: "2026-11-03", count: 2, primaryRecipeName: "James Hoffmann Ultimate V60" },
      { date: "2026-11-05", count: 1, primaryRecipeName: "James Hoffmann Ultimate V60" },
      { date: "2026-11-07", count: 2, primaryRecipeName: "James Hoffmann Ultimate V60" },
      { date: "2026-11-09", count: 2, primaryRecipeName: "James Hoffmann Ultimate V60" },
      { date: "2026-11-11", count: 1, primaryRecipeName: "James Hoffmann Ultimate V60" },
      { date: "2026-11-12", count: 2, primaryRecipeName: "James Hoffmann Ultimate V60" },
      { date: "2026-11-14", count: 1, primaryRecipeName: "James Hoffmann Ultimate V60" },
    ],
  };
}

interface OpenOptions {
  readonly fixedIso?: string;
  readonly listResponse?: object;
  readonly calendarByMonth?: Record<string, object>;
  readonly dayLogsByDate?: Record<string, object[]>;
  readonly onListRequest?: (url: URL) => void;
}

async function open(
  page: Page,
  viewport: { width: number; height: number },
  options: OpenOptions = {},
) {
  await page.clock.setFixedTime(
    new Date(options.fixedIso ?? "2026-10-10T01:00:00Z"),
  );
  await page.setViewportSize(viewport);
  await installStubs(page);

  await page.route("**/api/v1/brew-logs/calendar**", (route) => {
    const url = new URL(route.request().url());
    const month = url.searchParams.get("month") ?? "";
    const matched = options.calendarByMonth?.[month];
    return route.fulfill({
      json: matched ?? { month, totalCount: 0, days: [] },
    });
  });

  await page.route(/\/api\/v1\/brew-logs(\?|$)/, (route) => {
    const url = new URL(route.request().url());
    const date = url.searchParams.get("date");
    if (date !== null) {
      return route.fulfill({
        json: makePageOf(options.dayLogsByDate?.[date] ?? []),
      });
    }
    options.onListRequest?.(url);
    return route.fulfill({ json: options.listResponse ?? brewLogPage });
  });

  await page.goto("/brews");
  await page.waitForLoadState("networkidle");
}

test.describe("기록 탭 — 모바일 390 (시안 F1 · F2)", () => {
  test("AC-QUICKBREW-31 · 제목 옆 N잔(totalElements)과 세그먼트 전환 시 목록 600px 스크롤을 복원한다", async ({
    page,
  }) => {
    const manyLogs = Array.from({ length: 20 }, (_, i) => ({
      ...brewLogWithTds,
      id: 100 + i,
      // 하루 1잔씩 KST 2026-10-10부터 거슬러 내려가 스크롤 높이 > 1400px 확보
      brewedAt: new Date(
        Date.UTC(2026, 9, 10 - i, 1, 0, 0),
      ).toISOString(),
    }));

    await open(page, MOBILE, {
      fixedIso: "2026-10-10T01:00:00Z",
      listResponse: makePageOf(manyLogs, { totalElements: 142, hasNext: true }),
      calendarByMonth: {
        "2026-10": {
          month: "2026-10",
          totalCount: 5,
          days: [{ date: "2026-10-10", count: 1 }],
        },
      },
    });

    await expect(page.getByText("142잔", { exact: true })).toBeVisible();
    await expect(
      page.getByRole("heading", { level: 1, name: "기록" }),
    ).toBeVisible();
    const listBtn = page.getByRole("button", { name: "목록", exact: true });
    const calBtn = page.getByRole("button", { name: "달력", exact: true });
    await expect(listBtn).toHaveAttribute("aria-pressed", "true");
    await expect(calBtn).toHaveAttribute("aria-pressed", "false");

    await page.evaluate(() => window.scrollTo(0, 600));
    await expect
      .poll(() => page.evaluate(() => Math.round(window.scrollY)))
      .toBe(600);

    await calBtn.click();
    await expect(calBtn).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByText("2026.10", { exact: true })).toBeVisible();
    // 모바일 F2는 월 헤더 건수 라벨을 생략한다(AC-HOMECAL-40).
    await expect(page.getByText(/일 · .*잔/)).toHaveCount(0);

    await listBtn.click();
    await expect(listBtn).toHaveAttribute("aria-pressed", "true");
    await expect
      .poll(() => page.evaluate(() => Math.round(window.scrollY)))
      .toBe(600);
  });

  test("AC-MYCUPS-12 · 행 전체가 기록 상세 링크다 (모바일)", async ({
    page,
  }) => {
    await open(page, MOBILE);

    await page
      .locator('[data-date-group="2026-08-31"] a[href="/brews/2"]')
      .click();
    await expect(page).toHaveURL(/\/brews\/2$/);
  });
});

test.describe("기록 탭 — 웹 1440 (시안 FW)", () => {
  for (const [dateGroup, id] of [
    ["2026-08-31", 2],
    ["2026-08-30", 3],
  ] as const) {
    test(`AC-MYCUPS-12 · ${dateGroup} 원장 행을 누르면 /brews/${id}로 간다 (웹)`, async ({
      page,
    }) => {
      await open(page, WEB);

      await page
        .locator(`[data-date-group="${dateGroup}"] a[href="/brews/${id}"]`)
        .click();
      await expect(page).toHaveURL(new RegExp(`/brews/${id}$`));
    });
  }

  test("AC-QUICKBREW-35 · 웹 달력 모드는 우측 300px 카드를 감추고 720px 달력 카드와 선택 날짜 DayList를 보여준다", async ({
    page,
  }) => {
    await open(page, WEB, {
      fixedIso: "2026-11-14T01:00:00Z",
      listResponse: makePageOf([
        { ...brewLogWithTds, id: 2, brewedAt: "2026-11-14T02:00:00Z" },
      ]),
      calendarByMonth: {
        "2026-11": calendarDaysFor2026Nov(),
      },
      dayLogsByDate: {
        "2026-11-14": [
          { ...brewLogWithTds, id: 2, brewedAt: "2026-11-14T02:00:00Z" },
        ],
      },
    });

    const asideBox = await page.locator("aside").boundingBox();
    expect(Math.round(asideBox!.width)).toBe(300);

    await page.getByRole("button", { name: "달력", exact: true }).click();
    await expect(page.locator("aside")).toHaveCount(0);

    const card = page
      .locator("div.rounded-\\[12px\\]")
      .filter({ hasText: "8일 · 12잔" });
    await expect(card).toBeVisible();
    const cardBox = await card.boundingBox();
    expect(Math.round(cardBox!.width)).toBe(720);

    await expect(page.getByText("11.14 토 · 1잔", { exact: true })).toBeVisible();
    await expect(
      page.getByText("James Hoffmann Ultimate V60").first(),
    ).toBeVisible();
  });

  test("AC-QUICKBREW-36 · 웹 300px 카드 ‹ › 월 이동, 로드된 날짜 스크롤, 미로드 날짜 달력 전환", async ({
    page,
  }) => {
    const listRequests: string[] = [];
    // 11.14에 12건, 11.12에 1건을 두어 11.12 그룹이 처음에는 뷰포트 아래(top >= 900)에 있게 한다.
    const loadedLogs = [
      ...Array.from({ length: 12 }, (_, i) => ({
        ...brewLogWithTds,
        id: 200 + i,
        brewedAt: `2026-11-14T${String(10 - Math.floor(i / 2)).padStart(2, "0")}:00:00Z`,
      })),
      { ...brewLogWithTds, id: 212, brewedAt: "2026-11-12T02:00:00Z" },
    ];

    await open(page, WEB, {
      fixedIso: "2026-11-14T01:00:00Z",
      listResponse: makePageOf(loadedLogs, { totalElements: 14 }),
      calendarByMonth: {
        "2026-11": calendarDaysFor2026Nov(),
        "2026-10": {
          month: "2026-10",
          totalCount: 1,
          days: [
            {
              date: "2026-10-05",
              count: 1,
              primaryRecipeName: "James Hoffmann Ultimate V60",
            },
          ],
        },
      },
      dayLogsByDate: {
        "2026-10-05": [
          { ...brewLogWithTds, id: 99, brewedAt: "2026-10-05T02:00:00Z" },
        ],
      },
      onListRequest: (url) => listRequests.push(url.toString()),
    });

    expect(listRequests).toHaveLength(1);
    const aside = page.locator("aside");
    const targetGroup = page.locator('[data-date-group="2026-11-12"]');
    expect(
      await targetGroup.evaluate((el) => el.getBoundingClientRect().top),
    ).toBeGreaterThanOrEqual(900);

    await aside.locator('[data-date="2026-11-12"]').click();
    await expect(
      page.getByRole("button", { name: "목록", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect
      .poll(() => targetGroup.evaluate((el) => el.getBoundingClientRect().top))
      .toBeLessThan(900);
    expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);

    await aside.getByRole("button", { name: "이전 달" }).click();
    await expect(aside.getByText("2026.10", { exact: true })).toBeVisible();

    await aside.locator('[data-date="2026-10-05"]').click();
    await expect(
      page.getByRole("button", { name: "달력", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByText("10.05 월 · 1잔", { exact: true })).toBeVisible();
    // 추가 목록 페이지 요청 없이 달력 모드로 전환해 DayList만 부른다.
    expect(listRequests).toHaveLength(1);
  });
});

test.describe("기록 탭 — 900px 접힘 & 가로 스크롤", () => {
  test("AC-QUICKBREW-37 · 900×900에서 이번 주 한 줄로 접혀 시작하고 줄을 누르면 한 달로 펼쳐진다", async ({
    page,
  }) => {
    await open(page, TABLET, {
      fixedIso: "2026-11-14T01:00:00Z",
      listResponse: makePageOf([
        { ...brewLogWithTds, id: 2, brewedAt: "2026-11-14T02:00:00Z" },
      ]),
      calendarByMonth: {
        "2026-11": calendarDaysFor2026Nov(),
      },
    });

    await expect(page.getByTestId("calendar-row")).toHaveCount(1);
    await expect(
      page.locator('[data-testid="calendar-week-grid"] button'),
    ).toHaveCount(1);

    const asideBox = await page.locator("aside").boundingBox();
    const ledgerBox = await page.locator("[data-brew-ledger]").boundingBox();
    expect(asideBox!.y + asideBox!.height).toBeLessThanOrEqual(
      ledgerBox!.y + 1,
    );

    await page.getByRole("button", { name: "이번 주 달력 펼치기" }).click();
    expect(await page.getByTestId("calendar-row").count()).toBeGreaterThan(1);
  });

  for (const viewport of [
    MOBILE,
    { width: 760, height: 1024 },
    TABLET,
    WEB,
  ] as const) {
    test(`AC-MYCUPS-23 · ${viewport.width}px 목록·달력 모드에서 가로 스크롤이 없다`, async ({
      page,
    }) => {
      await open(page, viewport, {
        fixedIso: "2026-11-14T01:00:00Z",
        listResponse: makePageOf([
          { ...brewLogWithTds, id: 2, brewedAt: "2026-11-14T02:00:00Z" },
        ]),
        calendarByMonth: { "2026-11": calendarDaysFor2026Nov() },
      });

      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(viewport.width);

      await page.getByRole("button", { name: "달력", exact: true }).click();
      await page.waitForLoadState("networkidle");

      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(viewport.width);
    });
  }
});
