import { expect, test } from "@playwright/test";
import { SCREENS } from "./screens";
import { TARGETS, undersized } from "./hitArea";
import { installStubs } from "./stubs";

/**
 * 터치 타깃 44×44px.
 *
 * <p><b>소스 검사를 쓰지 않는다.</b> 클래스가 붙어 있어도 부모가 짓누르면 44px가 안 되고,
 * 그건 렌더 측정만 잡는다.
 */

test.describe("터치 타깃 — 예외", () => {
  /**
   * 예외는 **산문·제목 안의 링크**다. 글줄에 녹아 있어 높이를 강제하면 줄간격이 무너진다.
   *
   * <p><b>경로마다 테스트를 나눈다.</b> 한 테스트 안에서 여러 경로를 연속 이동하면 두 번째부터
   * 데이터가 붙지 않아 링크가 아예 안 그려진다 — 그러면 「예외가 0개」라는 거짓 초록이 된다.
   */
  const EXPECTED: Record<string, number> = {
    "/": 0,
    "/recipes": 0,
    "/recipes/12": 1, // <p> 안의 출처 링크 James Hoffmann
    "/brews": 0,
    "/brews/2": 1, // <h1> 안의 레시피 제목
    "/more": 0,
  };

  for (const [path, expected] of Object.entries(EXPECTED)) {
    test(`AC-TOUCH-03 · ${path}의 예외가 ${expected}개다`, async ({ page }) => {
      await installStubs(page);
      await page.goto(path);
      await page.waitForLoadState("networkidle");

      // 브라우저 네이티브 querySelectorAll을 쓴다. 스윕과 **같은 엔진**이어야 판정이 갈리지 않는다.
      const count = await page.evaluate(
        () =>
          document.querySelectorAll(":is(p, h1, h2, h3, h4, h5, h6) a").length,
      );

      expect(count).toBe(expected);
    });
  }
});

test.describe("터치 타깃 — 아이콘 버튼", () => {
  test("AC-TOUCH-04 · ★ 별점 5개가 각각 44×44다", async ({ page }) => {
    await installStubs(page);
    await page.goto("/brews/new?recipeId=12");

    for (const star of [1, 2, 3, 4, 5]) {
      const stars = page.getByRole("button", { name: `별점 ${star}` });
      await expect(stars).toHaveCount(1);

      expect(await stars.evaluateAll(undersized)).toEqual([]);
    }
  });

  test("AC-TOUCH-05 · 스텝 행의 ↑ ↓ 삭제가 각각 44×44다", async ({ page }) => {
    await installStubs(page);
    await page.goto("/recipes/3/edit");

    for (const name of ["스텝 2 위로", "스텝 2 아래로", "스텝 2 삭제"]) {
      const button = page.getByRole("button", { name });
      await expect(button).toHaveCount(1);

      expect(await button.evaluateAll(undersized)).toEqual([]);
    }
  });

  test("AC-TOUCH-07 · disabled인 ↑ ↓도 44×44다", async ({ page }) => {
    await installStubs(page);
    await page.goto("/recipes/3/edit");

    // 첫 스텝의 ↑와 마지막 스텝의 ↓가 disabled다. 스텝 수는 스텁 레시피(kasuyaRecipe)가 정한다.
    const first = page.getByRole("button", { name: "스텝 1 위로" });
    await expect(first).toBeVisible();
    const count = await page.locator("[data-step-row]").count();
    const last = page.getByRole("button", { name: `스텝 ${count} 아래로` });

    await expect(first).toBeDisabled();
    await expect(last).toBeDisabled();

    expect(await first.evaluateAll(undersized)).toEqual([]);
    expect(await last.evaluateAll(undersized)).toEqual([]);
  });
});

test.describe("터치 타깃 — 스윕", () => {
  for (const { path } of SCREENS) {
    test(`AC-TOUCH-01 · AC-READ-18 · AC-SKIN-09 · ${path}의 모든 타깃이 44×44 이상이다`, async ({
      page,
    }) => {
      await installStubs(page);
      await page.goto(path);
      await page.waitForLoadState("networkidle");

      expect(await page.locator(TARGETS).evaluateAll(undersized)).toEqual([]);
    });

    test(`AC-TOUCH-12 · ${path}에 가로 스크롤이 없다`, async ({ page }) => {
      await installStubs(page);
      await page.goto(path);
      await page.waitForLoadState("networkidle");

      const width = await page.evaluate(
        () => document.documentElement.scrollWidth,
      );

      expect(width).toBeLessThanOrEqual(360);
    });
  }
});

/**
 * 웹 폭에서만 보이는 요소(상단 바 내비 등)는 360 스윕이 밟지 못한다(#183). ADR 0010의 44×44는
 * 폭과 무관하다.
 */
test.describe("터치 타깃 — 웹 1440 스윕", () => {
  test.use({ viewport: { width: 1440, height: 900 } });
  for (const { path } of SCREENS) {
    test(`AC-TOUCH-13 · 1440px ${path}의 모든 타깃이 44×44 이상이다`, async ({
      page,
    }) => {
      await installStubs(page);
      await page.goto(path);
      await page.waitForLoadState("networkidle");

      expect(await page.locator(TARGETS).evaluateAll(undersized)).toEqual([]);
    });
  }
});

/**
 * 부품 키트의 세그먼트·알약은 보이는 높이가 36px 안팎이다(목업 값). `hit-44`가 누르는 영역을
 * 채우므로 통과해야 한다 — 측정이 의사 요소를 보는지가 여기서 갈린다(docs/decisions/0010).
 */
test("AC-TOUCH-01 · /dev/kit의 작은 컨트롤도 누르는 영역이 44×44 이상이다", async ({
  page,
}) => {
  await installStubs(page);
  await page.goto("/dev/kit");

  const small = page
    .getByRole("radio")
    .or(page.locator("button[aria-pressed]"));
  // 세그먼트 2 + 알약 3 + 맛 도트 15(docs/specs/2026-10-11-brew-form-fidelity.md)
  await expect(small).toHaveCount(20);
  const boxes = await small.evaluateAll((els) =>
    els.map((el) => el.getBoundingClientRect().height),
  );
  expect(Math.max(...boxes)).toBeLessThan(44);

  expect(await small.evaluateAll(undersized)).toEqual([]);
});

test.describe("터치 타깃 — 다이얼로그", () => {
  const CASES = [
    // 원두 등록은 고르기 다이얼로그 안의 `+ 새 원두`로 들어간다(docs/specs/2026-09-27-brew-form-redesign.md).
    {
      path: "/brews/new?recipeId=12",
      open: ["원두 변경"],
      what: "BeanPickerDialog",
    },
    {
      path: "/brews/new?recipeId=12",
      open: ["원두 변경", "+ 새 원두"],
      what: "BeanBatchDialog",
    },
    {
      path: "/brews/new?recipeId=12",
      // 모바일에서 그라인더 등록은 `장비` 시트 안에 있다(AC-BREWFIT-12).
      open: ["장비 변경", "+ 그라인더 등록"],
      what: "UserGrinderDialog",
    },
    // /recipes/12는 hoffmann이고 ownerUserId가 없어 삭제 버튼이 없다. /recipes/3이 내 것이다.
    { path: "/recipes/3", open: ["삭제"], what: "DeleteRecipeDialog" },
    { path: "/brews/2", open: ["삭제"], what: "DeleteBrewLogDialog" },
  ] as const;

  for (const { path, open, what } of CASES) {
    test(`AC-TOUCH-02 · ${what}의 타깃이 44×44 이상이다`, async ({ page }) => {
      await installStubs(page);
      await page.goto(path);
      for (const name of open) {
        await page.getByRole("button", { name }).click();
      }

      expect(await page.locator(TARGETS).evaluateAll(undersized)).toEqual([]);
    });
  }
});
