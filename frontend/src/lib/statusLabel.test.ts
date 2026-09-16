import { describe, expect, it } from "vitest";
import { statusLabel } from "./statusLabel";

/**
 * 상태값 한글 — docs/specs/2026-09-15-structure.md
 *
 * <p>백엔드 enum은 그대로 두고 표시 계층에서만 바꾼다. 대문자 영어 배지는 브랜드 문서의
 * 「외래어보다 우리말」과 어긋나고, AI 생성 페이지의 흔한 표시이기도 하다.
 */
describe("상태값 한글", () => {
  it("AC-STRUCT-15 · enum 9개 값이 정해진 한글로 변환된다", () => {
    expect(statusLabel("strength", "WEAK")).toBe("옅음");
    expect(statusLabel("strength", "IDEAL")).toBe("적정");
    expect(statusLabel("strength", "STRONG")).toBe("진함");

    expect(statusLabel("extraction", "UNDER")).toBe("부족");
    expect(statusLabel("extraction", "IDEAL")).toBe("적정");
    expect(statusLabel("extraction", "OVER")).toBe("과다");

    expect(statusLabel("degassing", "TOO_FRESH")).toBe("너무 신선함");
    expect(statusLabel("degassing", "IDEAL")).toBe("적정");
    expect(statusLabel("degassing", "PAST_PEAK")).toBe("정점 지남");
  });

  it("AC-STRUCT-16 · CURATED가 「기본 제공」이 된다", () => {
    expect(statusLabel("source", "CURATED")).toBe("기본 제공");
  });

  it("모르는 값은 그대로 돌려준다", () => {
    // 백엔드가 enum을 늘렸을 때 화면이 빈칸이 되지 않게 한다. 영어가 그대로 보이는 편이
    // 아무것도 안 보이는 것보다 낫다.
    expect(statusLabel("strength", "FUTURE_VALUE")).toBe("FUTURE_VALUE");
  });
});
