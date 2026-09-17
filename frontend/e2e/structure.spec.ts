import { expect, test } from "@playwright/test";
import { installStubs } from "./stubs";

/**
 * 구조와 폼 — docs/specs/2026-09-15-structure.md
 *
 * <p>폼의 폭과 타임라인 위치는 렌더 측정으로만 판정한다. 클래스가 붙어 있어도 부모가 짓누르면
 * 좌표가 달라진다 — touch-targets·readability가 같은 이유로 렌더를 쟀다.
 */

/** 화면에 남아 있으면 안 되는 백엔드 enum 값. */
const ENUM_WORDS = [
  "IDEAL",
  "UNDER",
  "OVER",
  "WEAK",
  "STRONG",
  "TOO_FRESH",
  "PAST_PEAK",
  "CURATED",
];

test.describe("구조 — 상태값", () => {
  for (const path of ["/brews/2", "/recipes", "/recipes/12"]) {
    test(`AC-STRUCT-14 · ${path}에 영어 상태값이 없다`, async ({ page }) => {
      await installStubs(page);
      await page.goto(path);
      await page.waitForLoadState("networkidle");

      const text = await page.locator("body").innerText();

      for (const word of ENUM_WORDS) {
        expect(text, `${path}에 ${word}가 남아 있다`).not.toContain(word);
      }
    });
  }

  test("AC-STRUCT-16 · CURATED가 「기본 제공」으로 렌더된다", async ({
    page,
  }) => {
    await installStubs(page);
    await page.goto("/recipes");
    await page.waitForLoadState("networkidle");

    // 픽스처 레시피 2건이 모두 CURATED다.
    await expect(page.getByText("기본 제공")).toHaveCount(2);
  });
});

test.describe("구조 — 대표 수치", () => {
  // 36px 클래스로 찾지 않는다. 스타일이 바뀔 때마다 셀렉터가 깨진다.
  for (const path of ["/recipes", "/recipes/12"]) {
    test(`AC-STRUCT-17 · ${path}의 대표 수치가 1:비율이다`, async ({
      page,
    }) => {
      await installStubs(page);
      await page.goto(path);
      await page.waitForLoadState("networkidle");

      /*
       * 갱신(2026-09-17): 히어로 도입으로 대표 수치가 `dl > dd`에서 판 위의 값 하나가 됐다.
       * 라벨은 아이브로우가 판 밖에서 맡으므로 `data-lead`의 텍스트가 곧 값이다.
       * 목록 카드는 아직 `dd` 구조라 둘 다 받는다.
       */
      const lead = page.locator("[data-lead]").first();
      const dd = lead.locator("dd");
      const text = (await dd.count()) > 0
        ? await dd.first().innerText()
        : await lead.innerText();

      expect(text, path).toMatch(/^1:\d+\.\d$/);
      expect(text, path).not.toContain("→");
    });
  }

  for (const path of ["/brews", "/brews/2"]) {
    test(`AC-STRUCT-18 · ${path}의 대표 수치가 1:비율이다`, async ({
      page,
    }) => {
      await installStubs(page);
      await page.goto(path);
      await page.waitForLoadState("networkidle");

      /*
       * 갱신(2026-09-17): 히어로 도입으로 대표 수치가 `dl > dd`에서 판 위의 값 하나가 됐다.
       * 라벨은 아이브로우가 판 밖에서 맡으므로 `data-lead`의 텍스트가 곧 값이다.
       * 목록 카드는 아직 `dd` 구조라 둘 다 받는다.
       */
      const lead = page.locator("[data-lead]").first();
      const dd = lead.locator("dd");
      const text = (await dd.count()) > 0
        ? await dd.first().innerText()
        : await lead.innerText();

      expect(text, path).toMatch(/^1:\d+\.\d$/);
    });
  }
});

const FORMS = [
  "/recipes/new",
  "/recipes/12/edit",
  "/brews/new?recipeId=12",
  "/gear/grind-converter",
] as const;

test.describe("구조 — 폼", () => {
  for (const path of FORMS) {
    test(`AC-STRUCT-01 · ${path}의 일반 필드가 right 1종류다`, async ({
      page,
    }) => {
      await installStubs(page);
      await page.goto(path);
      await page.waitForLoadState("networkidle");

      const rights = await page.evaluate(() => {
        const out = new Set<number>();
        for (const el of document.querySelectorAll("input, select, textarea")) {
          // 스텝 행은 예외다 — 한 줄에 컨트롤 여럿이 들어간다.
          if (el.closest("[data-step-row]")) continue;
          if (el.getAttribute("type") === "checkbox") continue;
          const rect = el.getBoundingClientRect();
          if (rect.width === 0) continue;
          out.add(Math.round(rect.right));
        }
        return [...out];
      });

      // 갱신(2026-09-17): 화면 좌우 거터가 16→24px가 되면서 344→336이 됐다
      // (docs/design/design_handoff_kaldi_note/README.md 「화면 좌우 거터: 모바일 24px」).
      expect(rights, path).toEqual([336]);
    });
  }

  test("AC-STRUCT-06 · 단위가 입력칸 안에 있다", async ({ page }) => {
    await installStubs(page);
    await page.goto("/recipes/new");
    await page.waitForLoadState("networkidle");

    const input = await page.getByLabel("원두량").boundingBox();
    const unit = await page.locator("[data-unit]").first().boundingBox();

    expect(unit!.x + unit!.width).toBeLessThan(input!.x + input!.width);
  });
});

test.describe("구조 — 컨트롤", () => {
  test("AC-STRUCT-03 · select의 렌더 높이가 44px를 유지한다", async ({
    page,
  }) => {
    await installStubs(page);
    await page.goto("/recipes/new");
    await page.waitForLoadState("networkidle");

    const box = await page.getByLabel("공개 범위").boundingBox();

    expect(box!.height).toBe(44);
  });

  test("AC-STRUCT-04 · 체크박스가 20×20에 탭 영역 44×44다", async ({
    page,
  }) => {
    await installStubs(page);
    await page.goto("/recipes");
    await page.waitForLoadState("networkidle");

    const input = await page.locator('input[type="checkbox"]').boundingBox();
    const tap = await page
      .locator('label:has(input[type="checkbox"])')
      .boundingBox();

    expect({ w: input!.width, h: input!.height }).toEqual({ w: 20, h: 20 });
    expect(tap!.width).toBeGreaterThanOrEqual(44);
    expect(tap!.height).toBeGreaterThanOrEqual(44);
  });
});

test("AC-STRUCT-05 · 스텝 행의 열 위치가 행마다 같다", async ({ page }) => {
  await installStubs(page);
  await page.goto("/recipes/12/edit");
  await page.waitForLoadState("networkidle");

  const cols = await page.evaluate(() => {
    const types: number[] = [];
    const firstNums: number[] = [];
    for (const row of document.querySelectorAll("[data-step-row]")) {
      const select = row.querySelector("select");
      const num = row.querySelector("input");
      if (select) types.push(Math.round(select.getBoundingClientRect().left));
      if (num) firstNums.push(Math.round(num.getBoundingClientRect().left));
    }
    return { types: [...new Set(types)], firstNums: [...new Set(firstNums)] };
  });

  expect(cols.types).toHaveLength(1);
  expect(cols.firstNums).toHaveLength(1);
});

test.describe("구조 — 타임라인", () => {
  for (const path of ["/recipes/12", "/brews/2"]) {
    test(`AC-STRUCT-07 · ${path}의 스텝에 시간 축이 있다`, async ({ page }) => {
      await installStubs(page);
      await page.goto(path);
      await page.waitForLoadState("networkidle");

      await expect(page.locator("[data-timeline-axis]"), path).toHaveCount(1);
    });
  }

  // 한 테스트에서 두 번 goto하면 두 번째 화면의 요소를 기다리다 타임아웃한다.
  // 화면마다 독립 테스트로 나누고 「둘 다 48px」을 본다 — 같은 값임을 함의하면서 안정적이다.
  for (const path of ["/recipes/12", "/brews/2"]) {
    test(`AC-STRUCT-08 · ${path}의 시간 열이 48px다`, async ({ page }) => {
      await installStubs(page);
      await page.goto(path);
      await page.waitForLoadState("networkidle");

      const box = await page
        .locator('[data-testid="step-start"]')
        .first()
        .boundingBox();

      expect(Math.round(box!.width), path).toBe(48);
    });
  }

  test("AC-STRUCT-09 · 편집 화면에는 타임라인이 없다", async ({ page }) => {
    await installStubs(page);
    await page.goto("/recipes/12/edit");
    await page.waitForLoadState("networkidle");

    await expect(page.locator("[data-timeline-axis]")).toHaveCount(0);
  });
});

test("AC-STRUCT-21 · select에 화살표가 그려진다", async ({ page }) => {
  await installStubs(page);
  await page.goto("/recipes/new");
  await page.waitForLoadState("networkidle");

  // appearance-none만 주면 화살표가 사라져 드롭다운인지 알 수 없다.
  // Tailwind 임의값으로는 data URI가 생성되지 않아 globals.css에서 정의한다.
  const style = await page.getByLabel("공개 범위").evaluate((el) => {
    const computed = getComputedStyle(el);
    return { image: computed.backgroundImage, appearance: computed.appearance };
  });

  expect(style.appearance).toBe("none");
  expect(style.image).toContain("svg");
});

test.describe("구조 — 기록 비교표", () => {
  test("AC-STRUCT-10 · 기록 상세에 비교표 4행이 있다", async ({ page }) => {
    await installStubs(page);
    await page.goto("/brews/2");
    await page.waitForLoadState("networkidle");

    const labels = await page
      .locator("[data-compare] [data-compare-label]")
      .allInnerTexts();

    expect(labels).toEqual(["원두량", "물량", "물 온도", "추출 시간"]);
  });

  test("AC-STRUCT-11 · 값이 다를 때만 드러난다", async ({ page }) => {
    // 픽스처를 실제로 읽고 정한 기대값이다(2026-09-15 대조).
    //   레시피 hoffmann : dose 30.0 / water 500.0 / temp 100.0 / time 210
    //   기록   brewLog  : dose 20.0 / water 300.0 / temp  92.0 / time 210
    // 앞의 셋이 다르고 시간만 같다.
    await installStubs(page);
    await page.goto("/brews/2");
    await page.waitForLoadState("networkidle");

    const diffs = await page
      .locator("[data-compare] [data-diff]")
      .evaluateAll((els) => els.map((el) => el.getAttribute("data-diff")));

    expect(diffs).toEqual(["true", "true", "true", "false"]);
  });

  test("AC-STRUCT-12 · 「현재 레시피와 비교」 문구가 있다", async ({
    page,
  }) => {
    await installStubs(page);
    await page.goto("/brews/2");
    await page.waitForLoadState("networkidle");

    await expect(page.locator("[data-compare]")).toContainText(
      "현재 레시피와 비교",
    );
  });

  test("AC-STRUCT-13 · 레시피를 못 읽으면 실측값만 보여준다", async ({
    page,
  }) => {
    await installStubs(page, { recipeStatus: 404 });
    await page.goto("/brews/2");
    await page.waitForLoadState("networkidle");

    await expect(page.locator("[data-compare]")).toHaveCount(0);
    await expect(page.getByText("20.0g")).toBeVisible();
  });
});

test.describe("구조 — 빈 화면", () => {
  for (const path of ["/", "/brews"]) {
    test(`AC-STRUCT-19 · ${path}의 빈 화면이 레시피로 보낸다`, async ({
      page,
    }) => {
      await installStubs(page, { empty: "brewLogs" });
      await page.goto(path);
      await page.waitForLoadState("networkidle");

      const link = page.locator('[data-empty] a[href="/recipes"]');
      await expect(link, path).toHaveCount(1);

      const box = await link.boundingBox();
      expect(box!.height, path).toBeGreaterThanOrEqual(44);
    });
  }

  test("AC-STRUCT-20 · 빈 레시피 화면이 작성으로 보낸다", async ({ page }) => {
    await installStubs(page, { empty: "recipes" });
    await page.goto("/recipes");
    await page.waitForLoadState("networkidle");

    await expect(
      page.locator('[data-empty] a[href="/recipes/new"]'),
    ).toHaveCount(1);
  });
});
