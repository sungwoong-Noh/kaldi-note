import { expect, test, type Page } from "@playwright/test";
import { brewLogPage } from "../src/test/fixtures";
import { undersized } from "./hitArea";
import { installStubs } from "./stubs";

/**
 * 내 잔 — docs/specs/2026-10-10-my-cups-ledger.md (목업 02 BM1·BW1).
 *
 * <p>값은 스텁(`brewLogPage`: id 2 · 2026-08-31 · 20 g · 92 °C · 3:30 · 17.6 · ★ 4 / id 3 · 2026-08-30 ·
 * 시간·수율 없음 · ★ 3, 레시피 hoffmann · Hario V60 02, 원두 프릿츠 예가체프)에서 온다.
 * 오늘은 2026-10-10(KST)로 고정한다 — 연도가 바뀌어도 `08.31 월` 표기가 흔들리지 않게.
 */

const MOBILE = { width: 390, height: 844 } as const;
const WEB = { width: 1440, height: 900 } as const;

async function open(
  page: Page,
  viewport: { width: number; height: number },
  list: object = brewLogPage,
) {
  await page.clock.setFixedTime(new Date("2026-10-10T01:00:00Z"));
  await page.setViewportSize(viewport);
  await installStubs(page);
  // 아바타가 me의 실제 카카오 CDN 주소를 가리킨다. 외부 이미지가 실패하면 박스가 무너진다(#179) —
  // AC-GRAMMAR-03과 같이 1×1 PNG로 바꿔 끼워 이 화면의 배치만 잰다.
  await page.route(
    (url) => url.hostname.endsWith("kakaocdn.net"),
    (route) =>
      route.fulfill({
        contentType: "image/png",
        body: Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
          "base64",
        ),
      }),
  );
  // 목록만 바꿔 끼운다 — 나중에 등록한 route가 먼저 걸린다.
  await page.route(/\/api\/v1\/brew-logs(\?|$)/, (route) =>
    route.fulfill({ json: list }),
  );
  await page.goto("/brews");
  await page.waitForLoadState("networkidle");
}

test.describe("내 잔 — 모바일 390", () => {
  test("AC-MYCUPS-06 · 머리는 개수 eyebrow·제목·장식 아바타다", async ({ page }) => {
    await open(page, MOBILE);

    const eyebrow = page.getByText("My cups · 2", { exact: true });
    await expect(eyebrow).toBeVisible();
    expect(await eyebrow.evaluate((el) => getComputedStyle(el).textTransform)).toBe(
      "uppercase",
    );
    await expect(page.getByRole("heading", { level: 1, name: "내 잔" })).toBeVisible();

    // 숨겨진 웹 상단 바에도 「내 잔」 글자가 있다 — h1을 가진 머리만 잡는다.
    const header = page
      .locator("header")
      .filter({ has: page.getByRole("heading", { level: 1, name: "내 잔" }) });
    const avatar = header.locator("img, span.rounded-full").last();
    expect(await avatar.boundingBox()).toMatchObject({ width: 36, height: 36 });
    // 아바타는 누를 수 없다(AC-MYCUPS-06) — 머리 안에 링크·버튼이 없다.
    await expect(header.locator("a, button")).toHaveCount(0);
  });

  test("AC-MYCUPS-08 · 행 왼쪽 배전도 점이 10px다", async ({ page }) => {
    await open(page, MOBILE);

    await expect(page.getByText("08.31 월 · 92°C · 3:30")).toBeVisible();
    await expect(page.getByText("17.6 % · ★ 4")).toBeVisible();
    const dot = page.locator("[data-roast-dot]").first();
    expect(await dot.boundingBox()).toMatchObject({ width: 10, height: 10 });
  });

  test("AC-MYCUPS-10 · 통계 값은 Mono 22px다", async ({ page }) => {
    await open(page, MOBILE);

    const value = page.locator("[data-stat-label]").first().locator("xpath=following-sibling::*[1]");
    expect(await value.evaluate((el) => getComputedStyle(el).fontSize)).toBe("22px");
    expect(await value.evaluate((el) => getComputedStyle(el).fontFamily)).toMatch(/^"?IBM Plex Mono/);
  });

  test("AC-MYCUPS-11 · 전폭 「기록하기」가 /recipes로 간다", async ({ page }) => {
    await open(page, MOBILE);

    const cta = page.getByRole("link", { name: "기록하기" });
    await expect(cta).toHaveAttribute("href", "/recipes");
    const tiles = page.locator("[data-stat-label]").first().locator("xpath=../..");
    const [ctaBox, tilesBox] = [await cta.boundingBox(), await tiles.boundingBox()];
    expect(ctaBox!.width).toBe(tilesBox!.width);
  });

  test("AC-MYCUPS-12 · 행을 누르면 기록 상세로 간다 (모바일)", async ({ page }) => {
    await open(page, MOBILE);

    await page.getByText("08.31 월 · 92°C · 3:30").click();
    await expect(page).toHaveURL(/\/brews\/2$/);
  });

  test("AC-MYCUPS-22 · 알약과 더 보기의 누르는 영역이 44×44 이상이다", async ({ page }) => {
    await open(page, MOBILE, { ...brewLogPage, hasNext: true, totalPages: 2 });

    const controls = page
      .getByRole("group", { name: "내 잔 필터" })
      .getByRole("button")
      .or(page.getByRole("button", { name: "더 보기" }));
    await expect(controls).toHaveCount(4);
    expect(await controls.evaluateAll(undersized)).toEqual([]);
  });
});

test.describe("내 잔 — 웹 1440", () => {
  test("AC-MYCUPS-07 · 머리는 연도 eyebrow와 알약·개수가 한 줄이다", async ({ page }) => {
    await open(page, WEB);

    await expect(page.getByText("My cups · 2026", { exact: true })).toBeVisible();
    const pills = page.getByRole("group", { name: "내 잔 필터" });
    // 통계 「이번 달」 값과 글자가 같을 수 있다 — 알약 옆의 것만 잡는다.
    const count = pills.locator("xpath=..").getByText("2잔", { exact: true });
    await expect(pills.getByRole("button")).toHaveText(["전체", "이번 달", "★ 4 이상"]);
    const [p, c] = [await pills.boundingBox(), await count.boundingBox()];
    expect(Math.abs(p!.y + p!.height / 2 - (c!.y + c!.height / 2))).toBeLessThan(4);
  });

  test("AC-MYCUPS-09 · 표는 BW1의 열 순서·폭·정렬·보조줄을 갖는다", async ({ page }) => {
    await open(page, WEB);

    const headers = page.getByRole("columnheader");
    await expect(headers).toHaveText(["날짜", "레시피 / 원두", "원두량", "온도", "시간", "수율", "평가"]);
    const widths = await headers.evaluateAll((els) =>
      els.map((el) => Math.round(el.getBoundingClientRect().width)),
    );
    expect([widths[0], ...widths.slice(2)]).toEqual([108, 100, 90, 90, 100, 70]);

    const firstRow = page.getByRole("row").nth(1);
    const aligns = await firstRow
      .getByRole("cell")
      .evaluateAll((els) => els.map((el) => getComputedStyle(el).textAlign));
    expect(aligns.slice(2)).toEqual(["right", "right", "right", "right", "right"]);
    await expect(firstRow).toContainText("James Hoffmann Ultimate V60");
    await expect(firstRow.locator("[data-ledger-sub]")).toHaveText("프릿츠 예가체프 · Hario V60 02");
    await expect(firstRow.locator("[data-roast-dot]")).toHaveCount(1);
  });

  test("AC-MYCUPS-10 · 통계 값은 Mono 24px, 즐겨 쓴 레시피는 Sans 15px다", async ({ page }) => {
    await open(page, WEB);

    // 알약 「이번 달」과 글자가 같다 — 통계 라벨에서만 찾는다.
    const valueOf = (label: string) =>
      page
        .locator("[data-stat-label]")
        .filter({ hasText: new RegExp(`^${label}$`) })
        .locator("xpath=following-sibling::*[1]");
    const month = valueOf("이번 달");
    expect(await month.evaluate((el) => getComputedStyle(el).fontSize)).toBe("24px");
    expect(await month.evaluate((el) => getComputedStyle(el).fontFamily)).toMatch(/^"?IBM Plex Mono/);
    const recipe = valueOf("즐겨 쓴 레시피");
    expect(await recipe.evaluate((el) => getComputedStyle(el).fontSize)).toBe("15px");
    expect(await recipe.evaluate((el) => getComputedStyle(el).fontFamily)).toMatch(/^"?IBM Plex Sans KR/);
  });

  test("AC-MYCUPS-11 · 웹 본문에는 「기록하기」가 없다(상단 바 CTA 하나뿐)", async ({ page }) => {
    await open(page, WEB);

    await expect(page.getByRole("link", { name: "기록하기" })).toHaveCount(1);
  });

  /**
   * 날짜 칸은 레시피 칸 링크의 `::after`가 덮는다 — Playwright의 click은 「가로챈다」며 거부하므로
   * 그 좌표를 마우스로 직접 누른다(사람이 누르는 것과 같다). 둘째 행이 /brews/3으로 가는 것으로
   * `::after`가 자기 행만 덮는지(tr이 기준인지)도 본다.
   */
  for (const [row, id, date] of [
    [1, 2, "08.31"],
    [2, 3, "08.30"],
  ] as const) {
    test(`AC-MYCUPS-12 · ${row}번째 행의 날짜를 누르면 /brews/${id}로 간다 (웹)`, async ({ page }) => {
      await open(page, WEB);

      const box = await page
        .getByRole("row")
        .nth(row)
        .getByText(date, { exact: true })
        .boundingBox();
      await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2);
      await expect(page).toHaveURL(new RegExp(`/brews/${id}$`));
    });
  }

  test("AC-MYCUPS-15 · 점이 없는 행도 제목의 왼쪽 선이 같다", async ({ page }) => {
    const [first, second] = brewLogPage.content;
    const { beanBatchId: _omit, ...withoutBean } = second;
    void _omit;
    await open(page, WEB, { ...brewLogPage, content: [first, withoutBean] });

    const titles = page.getByRole("row").locator("a[href^='/brews/']");
    await expect(titles).toHaveCount(2);
    const xs = await titles.evaluateAll((els) =>
      els.map((el) => Math.round(el.getBoundingClientRect().left)),
    );
    expect(xs[0]).toBe(xs[1]);
    await expect(page.getByRole("row").nth(2).locator("[data-ledger-sub]")).toHaveText(
      "Hario V60 02",
    );
  });
});

test.describe("내 잔 — 가로 스크롤", () => {
  for (const viewport of [MOBILE, WEB]) {
    test(`AC-MYCUPS-23 · ${viewport.width}px에서 가로 스크롤이 없다`, async ({ page }) => {
      await open(page, viewport);

      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(viewport.width);
      const table = page.locator("table");
      if ((await table.count()) > 0) {
        const wrapper = table.locator("xpath=..");
        const [scroll, client] = await wrapper.evaluate((el) => [el.scrollWidth, el.clientWidth]);
        expect(scroll).toBe(client);
      }
    });
  }
});
