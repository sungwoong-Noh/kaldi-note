import { expect, test } from "@playwright/test";
import { installStubs } from "./stubs";
import { tokenColor } from "./tokenColor";

/**
 * 화면 간 일관성의 렌더 검사.
 *
 * <p><b>소스 검사는 「금지된 것이 없다」만 본다.</b> 클래스 이름을 틀리거나 유틸리티가 생성되지
 * 않으면 단위 테스트는 초록인데 화면에서 간격과 크기가 사라진다. 여기서만 그것을 잡는다.
 *
 * <p><b>이 스위트가 첫 실행에 전부 통과하는 것이 정상이다.</b> 고칠 것을 찾는 그물이 아니다.
 */

// 갱신(2026-09-17): 리터럴 색을 버리고 `tokenColor`로 기준을 만든다. visual.spec.ts와 같다.

/**
 * 스텁이 주는 것만 쓴다.
 *
 * <p><b>`/recipes/12`는 hoffmann이다</b>(30.0g → 500.0g · 1:16.7 · 100°C). kasuya는 id 3이다 —
 * `e2e/stubs.ts`의 핸들러 순서가 그렇게 정한다. 지어낸 값으로 쓰면 셀렉터가 빗나간다.
 */
// 갱신(2026-09-15): structure 스펙이 대표 수치를 1:비율로 통일하면서 `1:16.7`이 메타줄에서
// 대표 자리로 올라갔다. 메타줄 앵커를 거기 남은 값으로 바꾼다.
const META_ROWS = [
  { path: "/recipes", text: "100°C", what: "카드 보조줄" },
  { path: "/brews", text: "2026-08-31", what: "카드 보조줄" },
  { path: "/recipes/12", text: "100°C", what: "상세 메타줄" },
  // 「20.0g」은 비교표에도 있다(2026-09-15). 실측값에만 있는 분쇄도를 앵커로 쓴다.
  { path: "/brews/2", text: "22", what: "상세 실측값" },
] as const;

/** 대표 수치는 `data-lead`로 찾는다 — 텍스트로 찾으면 표현이 바뀔 때마다 깨진다. */
const LEAD_PATHS = ["/recipes", "/brews", "/recipes/12", "/brews/2"] as const;

/** `text`를 담은 요소에서 위로 올라가 `className`에 `token`을 가진 첫 조상. */
function ancestorWith(
  page: import("@playwright/test").Page,
  text: string,
  token: string,
) {
  return page
    .getByText(text, { exact: true })
    .first()
    .locator(`xpath=ancestor-or-self::*[contains(@class,'${token}')][1]`);
}

test.describe("일관성 — 렌더값", () => {
  for (const { path, text, what } of META_ROWS) {
    test(`AC-CONSIST-04 · ${path}의 ${what} column-gap이 12px다`, async ({
      page,
    }) => {
      await installStubs(page);
      await page.goto(path);

      const row = ancestorWith(page, text, "gap-x-3");
      await expect(row).toBeAttached();

      expect(await row.evaluate((el) => getComputedStyle(el).columnGap)).toBe(
        "12px",
      );
    });
  }

  // 화면마다 메타줄에 남은 라벨이 다르다(2026-09-15). `/brews/2`의 원두량·물량·물 온도·
  // 추출 시간은 비교표로 옮겨갔고 분쇄도만 실측값에 남는다.
  const META_LABELS = [
    { path: "/recipes/12", label: "물 온도" },
    { path: "/brews/2", label: "분쇄도" },
  ] as const;

  for (const { path, label: labelText } of META_LABELS) {
    test(`AC-CONSIST-07 · ${path}의 메타줄 라벨이 13px ink-3다`, async ({
      page,
    }) => {
      await installStubs(page);
      await page.goto(path);

      const label = page.getByText(labelText, { exact: true }).first();
      await expect(label).toBeVisible();

      expect(
        await label.evaluate((el) => getComputedStyle(el).fontSize),
      ).toBe("13px");
      expect(await label.evaluate((el) => getComputedStyle(el).color)).toBe(
        await tokenColor(page, "ink-3"),
      );
    });
  }

  /**
   * <b>이 검사는 클래스가 없어도 통과한다.</b> `globals.css`의 `body`가 이미
   * `font-variant-numeric: tabular-nums`를 걸어 모든 숫자가 상속으로 tabular가 되기 때문이다.
   *
   * <p>그래도 남긴다. 재는 것은 **클래스의 존재가 아니라 화면에 그려진 결과**이고, 누군가
   * `body` 규칙을 지우거나 어느 조상에 `font-variant-numeric: normal`을 걸면 여기가 빨개진다.
   * 대표 수치에 클래스가 붙어 있는지는 `AC-CONSIST-08`·`09`가 따로 본다.
   */
  for (const path of LEAD_PATHS) {
    test(`AC-CONSIST-14 · ${path}의 대표 수치가 tabular-nums로 그려진다`, async ({
      page,
    }) => {
      await installStubs(page);
      await page.goto(path);

      const lead = page.locator("[data-lead]").first();
      await expect(lead).toBeAttached();

      expect(
        await lead.evaluate((el) => getComputedStyle(el).fontVariantNumeric),
      ).toBe("tabular-nums");
    });
  }
});
