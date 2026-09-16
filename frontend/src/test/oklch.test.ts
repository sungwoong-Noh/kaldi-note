import { describe, expect, it } from "vitest";
import { luminance, ratioOf } from "./contrast";
import { oklchLuminance, parseOklch } from "./oklch";

/**
 * 계산기 자신을 검사한다.
 *
 * <p>토큰이 oklch로 바뀌면 대비 AC 전부가 이 파일의 함수 위에 선다. 여기가 틀리면
 * 나머지가 **거짓 통과**한다 — 값을 검사하는 것이 아니라 계산기를 검사하는 이유다.
 * `AC-READ-16`이 hex 계산기에 대해 한 일과 같다.
 */
describe("oklch 대비 계산기", () => {
  it("AC-DS2-05 · oklch 문자열을 L·C·h로 파싱한다", () => {
    expect(parseOklch("oklch(0.72 0.15 28)")).toEqual({
      L: 0.72,
      C: 0.15,
      h: 28,
    });
    // 공백이 여럿이거나 소수점이 없는 hue도 같은 결과여야 한다.
    expect(parseOklch("oklch(0.5  0.18  28)")).toEqual({
      L: 0.5,
      C: 0.18,
      h: 28,
    });
  });

  it("AC-DS2-05 · oklch 휘도가 같은 색의 hex 휘도와 일치한다", () => {
    // 교차검증. oklch 경로와 hex 경로는 서로를 부르지 않는 독립 구현이므로,
    // 둘이 같은 답을 내면 변환 계수가 맞다는 뜻이다.
    // oklch(0.50 0.18 28)은 #b3241f로 렌더된다(2026-09-17 실측).
    const viaOklch = oklchLuminance(parseOklch("oklch(0.50 0.18 28)"));
    const viaHex = luminance("#b3241f");
    // hex는 채널당 8비트로 양자화되므로 완전히 같을 수 없다.
    expect(viaOklch).toBeCloseTo(viaHex, 3);
  });

  it("AC-DS2-05 · 판정이 4.536을 통과로, 4.351을 미달로 준다", () => {
    // paper 위에서 L을 0.56 → 0.57로 한 칸 올리면 AA(4.5)를 지나 내려간다.
    const paper = oklchLuminance(parseOklch("oklch(0.99 0.004 85)"));
    const pass = oklchLuminance(parseOklch("oklch(0.56 0.02 70)"));
    const fail = oklchLuminance(parseOklch("oklch(0.57 0.02 70)"));

    expect(ratioOf(pass, paper)).toBeGreaterThanOrEqual(4.5);
    expect(ratioOf(fail, paper)).toBeLessThan(4.5);
  });

  it("AC-DS2-05 · 대비는 순서를 바꿔도 같다", () => {
    const a = oklchLuminance(parseOklch("oklch(0.22 0.015 60)"));
    const b = oklchLuminance(parseOklch("oklch(0.99 0.004 85)"));
    expect(ratioOf(a, b)).toBeCloseTo(ratioOf(b, a), 10);
  });
});
