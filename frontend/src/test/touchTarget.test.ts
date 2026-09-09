import { describe, expect, it } from "vitest";
import { meetsTouchTarget, TOUCH_TARGET_PX } from "./touchTarget";

describe("AC-TOUCH-11 · 판정 함수의 경계값", () => {
  it("기준이 44다", () => {
    expect(TOUCH_TARGET_PX).toBe(44);
  });

  it.each([
    [{ width: 44, height: 44 }, true],
    [{ width: 44, height: 43.9 }, false],
    [{ width: 43.9, height: 44 }, false],
    // 반올림하지 않는다. 43.99는 44가 아니다.
    [{ width: 43.99, height: 43.99 }, false],
    [{ width: 100, height: 44 }, true],
  ])("%o → %s", (box, expected) => {
    expect(meetsTouchTarget(box)).toBe(expected);
  });
});
