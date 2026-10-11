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
 * 대표 수치는 `data-lead`로 찾는다 — 텍스트로 찾으면 표현이 바뀔 때마다 깨진다.
 * "/brews"(목록)는 빠졌다 — AC-RECIPESBREWS-77이 대표 수치(히어로) 자체를 없앴다.
 */
const LEAD_PATHS = ["/recipes", "/recipes/12", "/brews/2"] as const;

test.describe("일관성 — 렌더값", () => {
  // 화면마다 메타줄에 남은 라벨이 다르다(2026-09-15). `/brews/2`의 원두량·물량·물 온도·
  // 추출 시간은 비교표로 옮겨갔고 분쇄도만 실측값에 남는다.
  /*
   * 갱신(2026-09-17): 히어로 판 안의 라벨은 `on-hero-dim`이다 — 어두운 판 위에서
   * `ink-3`는 읽히지 않는다. 판 밖 라벨만 `ink-3`를 지킨다.
   */
  // /brews/2는 실측값 메타줄이 없어지고 원장 행 라벨(목업 mono 10.5px)이 됐다 —
  // docs/specs/2026-10-11-brew-detail-fidelity.md AC-BDETAIL-08·18이 대체.
  const META_LABELS = [{ path: "/recipes/12", label: "기본 제공" }] as const;

  for (const { path, label: labelText } of META_LABELS) {
    test(`AC-CONSIST-07 · ${path}의 메타줄 라벨이 13px ink-3다`, async ({
      page,
    }) => {
      await installStubs(page);
      await page.goto(path);

      const label = page.getByText(labelText, { exact: true }).first();
      await expect(label).toBeVisible();

      expect(await label.evaluate((el) => getComputedStyle(el).fontSize)).toBe(
        "13px",
      );
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
