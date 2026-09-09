import { expect, test } from "@playwright/test";
import { meetsTouchTarget, TOUCH_TARGET_PX } from "../src/test/touchTarget";
import { SCREENS } from "./screens";
import { installStubs } from "./stubs";

/**
 * 터치 타깃 44×44px.
 *
 * <p><b>소스 검사를 쓰지 않는다.</b> 클래스가 붙어 있어도 부모가 짓누르면 44px가 안 되고,
 * 그건 렌더 측정만 잡는다.
 */

test.describe("터치 타깃 — 입력 요소", () => {
  test("AC-TOUCH-08 · 「원두량」 입력칸의 높이가 44px다", async ({ page }) => {
    await installStubs(page);
    await page.goto("/brews/new?recipeId=12");

    const box = await page.getByLabel("원두량").boundingBox();

    expect(box?.height).toBe(TOUCH_TARGET_PX);
  });

  test("AC-TOUCH-09 · 「공개 범위」 select의 높이가 44px다", async ({ page }) => {
    await installStubs(page);
    // 공개 범위는 BrewLogEditor(편집)에만 있다. 작성 폼(/brews/new)에는 없다.
    await page.goto("/brews/2/edit");

    const box = await page.getByLabel("공개 범위").boundingBox();

    expect(box?.height).toBe(TOUCH_TARGET_PX);
  });
});

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
      const box = await page
        .getByRole("button", { name: `별점 ${star}` })
        .boundingBox();

      expect(box, `별점 ${star}`).not.toBeNull();
      expect(
        meetsTouchTarget(box!),
        `별점 ${star} ${box!.width}x${box!.height}`,
      ).toBe(true);
    }
  });

  test("AC-TOUCH-05 · 스텝 행의 ↑ ↓ 삭제가 각각 44×44다", async ({ page }) => {
    await installStubs(page);
    await page.goto("/recipes/12/edit");

    for (const name of ["스텝 2 위로", "스텝 2 아래로", "스텝 2 삭제"]) {
      const box = await page.getByRole("button", { name }).boundingBox();

      expect(
        meetsTouchTarget(box!),
        `${name} ${box!.width}x${box!.height}`,
      ).toBe(true);
    }
  });

  test("AC-TOUCH-06 · 「내 레시피만」 체크박스가 44×44다", async ({ page }) => {
    await installStubs(page);
    await page.goto("/recipes");

    const box = await page
      .getByRole("checkbox", { name: "내 레시피만" })
      .boundingBox();

    expect(meetsTouchTarget(box!), `${box!.width}x${box!.height}`).toBe(true);
  });

  test("AC-TOUCH-07 · disabled인 ↑ ↓도 44×44다", async ({ page }) => {
    await installStubs(page);
    await page.goto("/recipes/12/edit");

    // hoffmann은 스텝이 7개다. 첫 스텝의 ↑와 마지막 스텝의 ↓가 disabled다.
    const first = page.getByRole("button", { name: "스텝 1 위로" });
    const last = page.getByRole("button", { name: "스텝 7 아래로" });

    await expect(first).toBeDisabled();
    await expect(last).toBeDisabled();

    expect(meetsTouchTarget((await first.boundingBox())!)).toBe(true);
    expect(meetsTouchTarget((await last.boundingBox())!)).toBe(true);
  });
});

/**
 * 예외 밖의 상호작용 요소 중 44×44에 못 미치는 것. 사람이 읽을 수 있는 문자열로 돌려준다.
 *
 * <p><b>`meetsTouchTarget`을 여기서 못 쓴다.</b> `page.evaluate`는 브라우저 안에서 돌아 Node
 * 모듈을 볼 수 없다. 숫자 44가 두 곳에 생기는 것을 알고 남긴다 — 경계값 자체는
 * `AC-TOUCH-11`이 단위 테스트로 못박는다.
 */
async function undersized(
  page: import("@playwright/test").Page,
): Promise<string[]> {
  return page.evaluate(() => {
    const all = [
      ...document.querySelectorAll("button, a, input, select, textarea"),
    ];
    const exempt = new Set(
      document.querySelectorAll(":is(p, h1, h2, h3, h4, h5, h6) a"),
    );
    return all
      .filter((el) => !exempt.has(el))
      .map((el) => {
        const r = el.getBoundingClientRect();
        const name =
          (el as HTMLElement).innerText?.trim().slice(0, 20) ||
          el.getAttribute("aria-label") ||
          (el as HTMLInputElement).type ||
          el.tagName.toLowerCase();
        return { name: name.replace(/\s+/g, " "), w: r.width, h: r.height };
      })
      .filter((b) => b.w < 44 || b.h < 44)
      .map((b) => `${b.name} ${Math.round(b.w)}x${Math.round(b.h)}`);
  });
}

test.describe("터치 타깃 — 스윕", () => {
  for (const { path } of SCREENS) {
    test(`AC-TOUCH-01 · ${path}의 모든 타깃이 44×44 이상이다`, async ({ page }) => {
      await installStubs(page);
      await page.goto(path);
      await page.waitForLoadState("networkidle");

      expect(await undersized(page)).toEqual([]);
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

  test("AC-TOUCH-10 · BottomNav 탭 4개가 90×44 그대로다", async ({ page }) => {
    await installStubs(page);
    await page.goto("/recipes");

    for (const name of ["홈", "레시피", "기록", "더보기"]) {
      const box = await page
        .getByRole("link", { name, exact: true })
        .boundingBox();

      expect(box, name).toMatchObject({ width: 90, height: 44 });
    }
  });
});

test.describe("터치 타깃 — 다이얼로그", () => {
  const CASES = [
    { path: "/brews/new?recipeId=12", open: "+ 원두 등록", what: "BeanBatchDialog" },
    { path: "/brews/new?recipeId=12", open: "+ 그라인더 등록", what: "UserGrinderDialog" },
    // /recipes/12는 hoffmann이고 ownerUserId가 없어 삭제 버튼이 없다. /recipes/3이 내 것이다.
    { path: "/recipes/3", open: "삭제", what: "DeleteRecipeDialog" },
    { path: "/brews/2", open: "삭제", what: "DeleteBrewLogDialog" },
  ] as const;

  for (const { path, open, what } of CASES) {
    test(`AC-TOUCH-02 · ${what}의 타깃이 44×44 이상이다`, async ({ page }) => {
      await installStubs(page);
      await page.goto(path);
      await page.getByRole("button", { name: open }).click();

      expect(await undersized(page)).toEqual([]);
    });
  }
});
