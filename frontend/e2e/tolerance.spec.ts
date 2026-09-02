import { expect, test } from "@playwright/test";
import { notBelow, withinTolerance } from "./tolerance";

test.describe("판정 함수", () => {
  test("AC-WEBLAYOUT-10 · 1px 어긋난 것은 통과한다", () => {
    expect(withinTolerance(799, 800)).toBe(true);
    expect(withinTolerance(801, 800)).toBe(true);
    expect(withinTolerance(800, 800)).toBe(true);
  });

  test("AC-WEBLAYOUT-11 · 2px 어긋난 것은 실패한다", () => {
    expect(withinTolerance(798, 800)).toBe(false);
    expect(withinTolerance(802, 800)).toBe(false);
  });

  test("초과 판정은 한쪽만 본다", () => {
    // 문서 폭 361은 허용, 362는 초과
    expect(notBelow(361, 360)).toBe(true);
    expect(notBelow(362, 360)).toBe(false);
    // 작은 쪽은 언제나 통과한다 — 가로 스크롤은 넘칠 때만 문제다
    expect(notBelow(100, 360)).toBe(true);
  });
});
