import { expect, test, type Page } from "@playwright/test";
import { undersized } from "./hitArea";
import { installStubs } from "./stubs";

/** docs/specs/2026-10-11-brew-form-fidelity.md — 기록 작성·편집 시안 정합. */

const NEW = "/brews/new?recipeId=12";
const EDIT = "/brews/2/edit";

async function open(page: Page, width: number, path = NEW, height = 900) {
  await installStubs(page);
  await page.setViewportSize({ width, height });
  await page.goto(path);
  await page.getByLabel("원두량").waitFor();
}

async function box(page: Page, selector: string) {
  const b = await page.locator(selector).first().boundingBox();
  if (b === null) throw new Error(`${selector}가 없다`);
  return b;
}

test("AC-BREWFIT-03 · 웹은 상단 바에 취소·기록하기가 있고 하단 동작 줄이 없다", async ({
  page,
}) => {
  await open(page, 1280);
  const banner = page.getByRole("banner");

  const submit = banner.getByRole("button", { name: "기록하기" });
  await expect(submit).toBeVisible();
  const b = await submit.boundingBox();
  expect(b!.y + b!.height).toBeLessThanOrEqual(80);
  await expect(banner.getByRole("button", { name: "취소" })).toBeVisible();
  await expect(page.getByRole("button", { name: "기록하기" })).toHaveCount(1);
  await expect(page.getByRole("link", { name: "기록하기" })).toHaveCount(0);
});

test.describe("AC-BREWFIT-04 · 오른쪽 칼럼 폭과 전환 지점", () => {
  for (const [width, heroWidth] of [
    [1280, 420],
    [1100, 360],
  ] as const) {
    test(`${width}px — 히어로 너비 ${heroWidth}px, 폼 오른쪽`, async ({
      page,
    }) => {
      await open(page, width);
      const hero = await box(page, "[data-hero]");
      const form = await box(page, "[data-brew-form]");

      expect(Math.round(hero.width)).toBe(heroWidth);
      expect(hero.x).toBeGreaterThan(form.x + form.width);
    });
  }

  test("1099px — 원장 필드가 보이고 물 온도 입력은 시트 안이다", async ({
    page,
  }) => {
    await open(page, 1099);
    await expect(
      page.locator("[data-kit='ledger-field']", { hasText: "온도·시간" }),
    ).toBeVisible();
    await expect(page.getByLabel("물 온도")).toHaveCount(0);
  });
});

test("AC-BREWFIT-05 · 웹 폼은 2열이다", async ({ page }) => {
  await open(page, 1280);
  const left = async (label: string) =>
    box(page, `[data-kit='section-label']:text-is("${label}")`);

  const [basic, numbers, gear, result, rating, memo] = await Promise.all(
    ["기본", "수치", "원두와 장비", "결과", "평가", "메모"].map(left),
  );
  expect(numbers.x).toBe(basic.x);
  expect(gear.x).toBe(basic.x);
  expect(rating.x).toBe(result.x);
  expect(memo.x).toBe(result.x);
  expect(result.x).toBeGreaterThan(basic.x);
  expect(Math.abs(result.y - basic.y)).toBeLessThan(4);
});

test.describe("AC-BREWFIT-15 · 웹은 5축이 늘 펼쳐져 있고 모바일은 시트다", () => {
  const AXES = /^(산미|단맛|바디|쓴맛|여운) [1-5]$/;

  test("1280px", async ({ page }) => {
    await open(page, 1280);
    await expect(page.getByRole("button", { name: AXES })).toHaveCount(25);
    await expect(page.getByRole("button", { name: "맛 자세히" })).toHaveCount(
      0,
    );
  });

  test("390px", async ({ page }) => {
    await open(page, 390);
    await expect(page.getByRole("button", { name: AXES })).toHaveCount(0);
    await page.getByRole("button", { name: "맛 자세히" }).click();
    await expect(
      page
        .getByRole("dialog", { name: "맛" })
        .getByRole("button", { name: AXES }),
    ).toHaveCount(25);
  });
});

test.describe("AC-BREWFIT-16 · 공개 범위 라벨은 폭과 상관없이 같다", () => {
  for (const path of [NEW, EDIT]) {
    for (const width of [1280, 390]) {
      test(`${path} — ${width}px`, async ({ page }) => {
        await open(page, width, path);
        const radios = page.getByRole("radio");

        await expect(radios).toHaveText(["나만 보기", "맞팔로우 친구", "전체"]);
        for (const radio of await radios.all()) {
          const b = await radio.boundingBox();
          expect(b!.height).toBeLessThan(40);
        }
      });
    }
  }
});

test.describe("AC-BREWFIT-17 · 모바일은 상단 저장과 하단 기록하기가 같은 동작이다", () => {
  for (const name of ["저장", "기록하기"]) {
    test(`${name}를 누르면 POST 1회`, async ({ page }) => {
      await open(page, 390, NEW, 844);
      let posts = 0;
      await page.route("**/api/v1/brew-logs", async (route) => {
        if (route.request().method() !== "POST") return route.fallback();
        posts += 1;
        await route.fulfill({
          status: 400,
          json: { code: "X", message: "중단" },
        });
      });

      await page.getByRole("button", { name, exact: true }).click();
      await expect.poll(() => posts).toBe(1);
    });
  }

  test("하단 기록하기는 화면 아래 24px 이내, 상단 줄은 취소·새 기록·저장", async ({
    page,
  }) => {
    await open(page, 390, NEW, 844);

    const bottom = await page
      .getByRole("button", { name: "기록하기" })
      .boundingBox();
    // 화면 밖(아래)이면 간격이 음수가 된다 — 「24 이하」만 보면 그것도 통과해 버린다.
    const gap = 844 - (bottom!.y + bottom!.height);
    expect(gap).toBeGreaterThanOrEqual(0);
    expect(gap).toBeLessThanOrEqual(24);

    await expect(page.getByRole("button", { name: "취소" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "새 기록" })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "저장", exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "뒤로" })).toHaveCount(0);
  });
});

test.describe("AC-BREWFIT-18 · 편집 화면은 제목과 버튼 이름만 다르다", () => {
  test("1280px", async ({ page }) => {
    await open(page, 1280, EDIT);
    const banner = page.getByRole("banner");

    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "기록 편집",
    );
    await expect(banner.getByRole("button", { name: "취소" })).toBeVisible();
    await expect(banner.getByRole("button", { name: "저장" })).toBeVisible();
    await expect(page.getByRole("button", { name: "기록하기" })).toHaveCount(0);
  });

  test("390px", async ({ page }) => {
    await open(page, 390, EDIT);

    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "기록 편집",
    );
    await expect(page.getByRole("button", { name: "저장" })).toHaveCount(2);
    await expect(page.getByRole("button", { name: "기록하기" })).toHaveCount(0);
  });
});

test("AC-BREWFIT-24 · 모바일 묶음 경고는 해당 행 위에 붙는다", async ({
  page,
}) => {
  await open(page, 390);
  await page.route("**/api/v1/brew-logs", (route) =>
    route.fulfill({
      status: 400,
      json: {
        code: "GRIND_SETTING_OUT_OF_RANGE",
        message: "이 그라인더에서 쓸 수 없는 설정값입니다.",
      },
    }),
  );
  await page.getByRole("button", { name: "기록하기" }).click();

  const warning = await box(page, "[data-warning]");
  const row = await box(page, "[data-kit='ledger-field']:has-text('장비')");
  expect(warning.y + warning.height).toBeLessThanOrEqual(row.y);
});

test("AC-BREWFIT-25 · 누르는 영역 44×44", async ({ page }) => {
  await open(page, 390);

  const closed = [
    page.getByRole("button", { name: /^별점 [1-5]$/ }),
    page.getByRole("radio"),
    page.getByRole("button", { name: /변경$/ }),
    page.getByLabel(/^(원두량|물량)$/),
  ];
  const counts = await Promise.all(closed.map((t) => t.count()));
  expect(counts).toEqual([5, 3, 6, 2]);

  const small: string[] = [];
  for (const target of closed)
    small.push(...(await target.evaluateAll(undersized)));

  await page.getByRole("button", { name: "맛 자세히" }).click();
  const dots = page.getByRole("button", {
    name: /^(산미|단맛|바디|쓴맛|여운) [1-5]$/,
  });
  await expect(dots).toHaveCount(25);
  small.push(...(await dots.evaluateAll(undersized)));
  small.push(
    ...(await page
      .getByRole("button", { name: "맛 자세히" })
      .evaluateAll(undersized)),
  );

  expect(small).toEqual([]);
});

test.describe("AC-BREWFIT-26 · 가로 스크롤이 없다", () => {
  for (const path of [NEW, EDIT]) {
    for (const width of [390, 1099, 1100, 1280]) {
      test(`${path} — ${width}px`, async ({ page }) => {
        await open(page, width, path);
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - window.innerWidth,
        );
        expect(overflow).toBeLessThanOrEqual(0);
      });
    }
  }
});
