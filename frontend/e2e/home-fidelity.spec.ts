import { expect, test, type Page } from "@playwright/test";
import { brewLogWithTds, hoffmannSummary } from "../src/test/fixtures";
import { undersized } from "./hitArea";
import { installStubs } from "./stubs";
import { tokenColor } from "./tokenColor";

/**
 * 홈 목업 정합 — docs/specs/2026-10-11-home-fidelity.md (목업 01 CW1·C1).
 *
 * <p>오늘은 2026-09-19(KST)로 고정한다 — 스텁 달력(`homeCalendar`)이 2026-09다. 레일은 스텁의
 * `나` + 맞팔로우 `지연` 1명이다.
 */

const MOBILE = { width: 390, height: 844 } as const;
const WEB = { width: 1440, height: 900 } as const;

async function open(
  page: Page,
  viewport: { width: number; height: number },
  /** 기본 스텁 뒤에 등록할 route — 나중에 등록한 route가 먼저 걸린다. */
  override?: (page: Page) => Promise<void>,
) {
  await page.clock.setFixedTime(new Date("2026-09-19T01:00:00Z"));
  await page.setViewportSize(viewport);
  await installStubs(page);
  // 아바타가 me의 실제 카카오 CDN 주소를 가리킨다 — 1×1 PNG로 바꿔 끼워 배치만 잰다(my-cups.spec.ts와 같다).
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
  await override?.(page);
  await page.goto("/");
  await expect(page.getByRole("tablist")).toBeVisible();
}

/** 칸 안 아바타 — 사진(img) 또는 이니셜 원(span.rounded-full) 중 하나다. */
function avatarOf(tab: ReturnType<Page["getByRole"]>) {
  return tab.locator("img, span.rounded-full").first();
}

test.describe("홈 정합 — 팔로우 레일 웹 1440", () => {
  test("AC-HOMEFIT-01 · 웹 팔로우 레일은 상단 바 아래 전폭 띠다", async ({
    page,
  }) => {
    await open(page, WEB);

    const rail = page.getByTestId("follow-rail");
    const box = await rail.boundingBox();
    const topBar = await page.locator("header").first().boundingBox();
    expect(box?.x).toBe(0);
    expect(box?.width).toBe(WEB.width);
    expect(box?.y).toBe((topBar?.y ?? 0) + (topBar?.height ?? 0));

    const style = await rail.evaluate((el) => {
      const s = getComputedStyle(el);
      return { padding: s.padding, borderBottom: s.borderBottomWidth };
    });
    expect(style).toEqual({ padding: "16px 48px", borderBottom: "1px" });
  });

  test("AC-HOMEFIT-02 · 웹 레일 알약은 CW1 값이다", async ({ page }) => {
    await open(page, WEB);

    const mine = page.getByRole("tab", { name: /나/ });
    const other = page.getByRole("tab", { name: /지연/ });

    expect(await avatarOf(mine).boundingBox()).toMatchObject({
      width: 32,
      height: 32,
    });

    const pill = await mine.evaluate((el) => {
      const s = getComputedStyle(el);
      const label = getComputedStyle(el.lastElementChild!);
      return {
        padding: s.padding,
        bg: s.backgroundColor,
        fontSize: label.fontSize,
        fontWeight: label.fontWeight,
      };
    });
    expect(pill).toEqual({
      padding: "6px 14px 6px 6px",
      bg: await tokenColor(page, "ink"),
      fontSize: "13.5px",
      fontWeight: "600",
    });

    const a = await mine.boundingBox();
    const b = await other.boundingBox();
    expect((b?.x ?? 0) - ((a?.x ?? 0) + (a?.width ?? 0))).toBe(18);
  });

  test("AC-HOMEFIT-03 · 웹 레일 끝은 구분선 뒤 「+ 초대」이고 /more로 간다", async ({
    page,
  }) => {
    await open(page, WEB);

    const invite = page.getByRole("link", { name: /초대/ });
    const circle = invite.locator("span").first();
    await expect(circle).toHaveText("+");
    expect(
      await circle.evaluate((el) => getComputedStyle(el).borderStyle),
    ).toBe("dashed");

    const divider = page
      .getByTestId("follow-rail")
      .locator('[aria-hidden="true"]')
      .last();
    expect(await divider.boundingBox()).toMatchObject({ width: 1, height: 24 });
    const d = await divider.boundingBox();
    const i = await invite.boundingBox();
    expect((d?.x ?? 0) < (i?.x ?? 0)).toBe(true);

    await invite.click();
    await expect(page).toHaveURL(/\/more$/);
  });
});

test.describe("홈 정합 — 팔로우 레일 모바일 390", () => {
  test("AC-HOMEFIT-03 · 모바일 레일 끝은 「+ 초대」이고 /more로 간다", async ({
    page,
  }) => {
    await open(page, MOBILE);

    const invite = page.getByRole("link", { name: /초대/ });
    const circle = invite.locator("span").first();
    await expect(circle).toHaveText("+");
    expect(
      await circle.evaluate((el) => getComputedStyle(el).borderStyle),
    ).toBe("dashed");

    await invite.click();
    await expect(page).toHaveURL(/\/more$/);
  });

  test("AC-HOMEFIT-04 · 모바일 레일은 C1 값이다", async ({ page }) => {
    await open(page, MOBILE);

    const mine = page.getByRole("tab", { name: /나/ });
    const other = page.getByRole("tab", { name: /지연/ });
    const avatar = avatarOf(mine);
    expect(await avatar.boundingBox()).toMatchObject({ width: 50, height: 50 });

    const labels = await Promise.all(
      [mine, other].map((tab) =>
        tab.evaluate((el) => {
          const s = getComputedStyle(el.lastElementChild!);
          return { fontSize: s.fontSize, fontWeight: s.fontWeight };
        }),
      ),
    );
    expect(labels).toEqual([
      { fontSize: "11.5px", fontWeight: "600" },
      { fontSize: "11.5px", fontWeight: "400" },
    ]);

    // 링은 아바타를 감싼 원의 안쪽 2px --ink 외곽선이다 — 목업처럼 50px 안에 그려 배치를 밀지 않는다.
    const ring = await mine.evaluate((el) => {
      const s = getComputedStyle(el.firstElementChild!);
      return { width: s.outlineWidth, color: s.outlineColor };
    });
    expect(ring).toEqual({
      width: "2px",
      color: await tokenColor(page, "ink"),
    });

    const avatarBox = await avatar.boundingBox();
    const labelBox = await mine.locator("> span").last().boundingBox();
    expect(
      Math.round(
        (labelBox?.y ?? 0) - ((avatarBox?.y ?? 0) + (avatarBox?.height ?? 0)),
      ),
    ).toBe(7);

    const a = await mine.boundingBox();
    const b = await other.boundingBox();
    expect((b?.x ?? 0) - ((a?.x ?? 0) + (a?.width ?? 0))).toBe(14);
  });
});

for (const [name, viewport] of [
  ["웹 1440", WEB],
  ["모바일 390", MOBILE],
] as const) {
  test.describe(`홈 정합 — 월 머리 ${name}`, () => {
    test("AC-HOMEFIT-05 · 월 머리는 한 줄이다", async ({ page }) => {
      await open(page, viewport);

      const month = await page
        .getByText("2026.09", { exact: true })
        .boundingBox();
      const count = await page
        .getByText("7 BREWS", { exact: true })
        .boundingBox();
      const center = (b: typeof month) => (b?.y ?? 0) + (b?.height ?? 0) / 2;
      expect(Math.abs(center(month) - center(count))).toBeLessThan(4);
    });

    test("AC-HOMEFIT-06 · 달 이동 버튼은 32×32 한 겹이다", async ({ page }) => {
      await open(page, viewport);

      const prev = page.getByRole("button", { name: "이전 달" });
      expect(await prev.boundingBox()).toMatchObject({ width: 32, height: 32 });
      const style = await prev.evaluate((el) => {
        const s = getComputedStyle(el);
        const borderedChildren = [...el.querySelectorAll("*")].filter(
          (child) => getComputedStyle(child).borderTopStyle !== "none",
        ).length;
        return {
          border: s.borderTopWidth,
          radius: s.borderTopLeftRadius,
          borderedChildren,
        };
      });
      expect(style).toEqual({
        border: "1px",
        radius: "7px",
        borderedChildren: 0,
      });
      expect(await prev.evaluateAll(undersized)).toEqual([]);
    });
  });
}

test.describe("홈 정합 — 웹 달력 칸 1440", () => {
  test("AC-HOMEFIT-07 · 웹 달력 칸의 요약 줄은 작다", async ({ page }) => {
    await open(page, WEB);

    const cell = page.getByRole("button", { name: /^9월 5일/ });
    const name = cell.getByText("Kasuya 4:6", { exact: true });
    const more = cell.getByText("외 1건", { exact: true });

    expect(
      await name.evaluate((el) => {
        const s = getComputedStyle(el);
        return {
          fontSize: s.fontSize,
          whiteSpace: s.whiteSpace,
          textOverflow: s.textOverflow,
        };
      }),
    ).toEqual({
      fontSize: "11.5px",
      whiteSpace: "nowrap",
      textOverflow: "ellipsis",
    });
    expect(await more.evaluate((el) => getComputedStyle(el).fontSize)).toBe(
      "11px",
    );

    const number = await cell.getByTestId("day-number").boundingBox();
    const dot = await cell.locator("[data-record-dot]").boundingBox();
    expect((dot?.x ?? 0) - ((number?.x ?? 0) + (number?.width ?? 0))).toBe(6);
  });
});

/** 선택 날짜 기록을 `n`건으로 바꿔 끼운다 — 달력·다른 목록 요청은 기본 스텁으로 넘긴다. */
async function stubDayLogs(page: Page, n: number) {
  const content = Array.from({ length: n }, (_, i) => ({
    ...brewLogWithTds,
    id: 100 + i,
  }));
  await page.route(/\/api\/v1\/brew-logs\?/, (route) => {
    if (new URL(route.request().url()).pathname !== "/api/v1/brew-logs")
      return route.fallback();
    return route.fulfill({
      json: {
        content,
        page: 0,
        size: 100,
        totalElements: n,
        totalPages: 1,
        hasNext: false,
      },
    });
  });
}

async function heights(page: Page) {
  const column = await page.getByTestId("day-column").boundingBox();
  const calendar = await page.getByTestId("calendar-area").boundingBox();
  return { column: column?.height ?? 0, calendar: calendar?.height ?? -99 };
}

test.describe("홈 정합 — 웹 오른쪽 칼럼 1440", () => {
  test("AC-HOMEFIT-08 · 웹 오른쪽 칼럼은 420px surface이고 달력 높이를 채운다", async ({
    page,
  }) => {
    await open(page, WEB);

    const column = page.getByTestId("day-column");
    const style = await column.evaluate((el) => {
      const s = getComputedStyle(el);
      return {
        width: s.width,
        pl: s.paddingLeft,
        pr: s.paddingRight,
        bg: s.backgroundColor,
      };
    });
    expect(style).toEqual({
      width: "420px",
      pl: "40px",
      pr: "40px",
      bg: await tokenColor(page, "surface"),
    });
    const h = await heights(page);
    expect(Math.abs(h.column - h.calendar)).toBeLessThanOrEqual(1);
  });

  test("AC-HOMEFIT-09 · 「이 날짜로 기록 추가」는 칼럼 맨 아래에 있다", async ({
    page,
  }) => {
    await open(page, WEB);

    const column = await page.getByTestId("day-column").boundingBox();
    const cta = await page
      .getByRole("link", { name: "이 날짜로 기록 추가" })
      .boundingBox();
    const gap =
      (column?.y ?? 0) +
      (column?.height ?? 0) -
      ((cta?.y ?? 0) + (cta?.height ?? 0));
    expect(gap).toBeGreaterThanOrEqual(0);
    expect(gap).toBeLessThanOrEqual(32);
  });

  test("AC-HOMEFIT-10 · 웹 날짜 머리는 「9월 19일」 26px·600과 「2 brews」 mono 12px다", async ({
    page,
  }) => {
    await open(page, WEB, (p) => stubDayLogs(p, 2));

    const date = page.getByTestId("day-header-date");
    await expect(date).toHaveText("9월 19일");
    expect(
      await date.evaluate((el) => {
        const s = getComputedStyle(el);
        return { fontSize: s.fontSize, fontWeight: s.fontWeight };
      }),
    ).toEqual({ fontSize: "26px", fontWeight: "600" });

    const count = page.getByTestId("day-header-count");
    await expect(count).toHaveText("2 brews");
    expect(await count.evaluate((el) => getComputedStyle(el).fontSize)).toBe(
      "12px",
    );
  });

  test("AC-HOMEFIT-18 · 카드가 넘쳐도 카드 영역만 스크롤된다", async ({
    page,
  }) => {
    await open(page, WEB, (p) => stubDayLogs(p, 5));
    await expect(page.getByTestId("day-card")).toHaveCount(5);

    const cards = page.getByTestId("day-cards");
    const scroll = await cards.evaluate((el) => ({
      sh: el.scrollHeight,
      ch: el.clientHeight,
    }));
    expect(scroll.sh).toBeGreaterThan(scroll.ch);
    await expect(
      page.getByRole("link", { name: "이 날짜로 기록 추가" }),
    ).toBeInViewport();
    expect(
      await page.evaluate(() => document.documentElement.scrollHeight),
    ).toBeLessThanOrEqual(WEB.height);
  });

  test("AC-HOMEFIT-19 · 6주 달에서도 칼럼 높이가 달력과 같다", async ({
    page,
  }) => {
    await page.clock.setFixedTime(new Date("2026-03-19T01:00:00Z"));
    await page.setViewportSize(WEB);
    await installStubs(page);
    await page.goto("/");
    await expect(page.getByText("2026.03", { exact: true })).toBeVisible();

    const h = await heights(page);
    expect(Math.abs(h.column - h.calendar)).toBeLessThanOrEqual(1);
  });
});

test.describe("홈 정합 — 웹 카드 1440", () => {
  test("AC-HOMEFIT-11 · 웹 카드 캡션은 원두 · 드리퍼 · 시각이다", async ({
    page,
  }) => {
    await open(page, WEB, (p) => stubDayLogs(p, 1));

    const card = page.getByTestId("day-card");
    const caption = card.getByText("프릿츠 예가체프 · Hario V60 02 · 18:00", {
      exact: true,
    });
    await expect(caption).toBeVisible();
    const size = (el: Element) => {
      const s = getComputedStyle(el);
      return { fontSize: s.fontSize, fontWeight: s.fontWeight };
    };
    expect(await caption.evaluate(size)).toMatchObject({ fontSize: "12px" });
    expect(
      await card
        .getByText(hoffmannSummary.title, { exact: true })
        .evaluate(size),
    ).toEqual({
      fontSize: "15.5px",
      fontWeight: "600",
    });
    expect(
      await card.getByTestId("day-card-metric").evaluate((el) => {
        const s = getComputedStyle(el);
        return {
          fontSize: s.fontSize,
          mono: s.fontFamily.includes("IBM Plex Mono"),
        };
      }),
    ).toEqual({ fontSize: "17px", mono: true });
  });
});
