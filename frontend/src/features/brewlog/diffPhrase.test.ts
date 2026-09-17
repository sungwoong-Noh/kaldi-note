import { describe, expect, it } from "vitest";
import { diffPhrase } from "./diffPhrase";

/**
 * 차이 문구 — docs/specs/2026-09-17-small-features.md
 *
 * <p>「같은 레시피를 여러 번 내렸을 때 결과 차이를 추적하는 것이 이 서비스의 존재 이유」인데
 * (CLAUDE.md), 비교표는 다른 값에 색을 칠할 뿐이라 **얼마나 달랐는지를 사용자가 암산**해야 했다.
 *
 * <p><b>평가하지 않는다.</b> 「1.0g 더 썼습니다」이지 「너무 많습니다」가 아니다.
 */
describe("diffPhrase", () => {
  it("AC-SMALL-01 · 더 쓴 무게를 말한다", () => {
    expect(diffPhrase("weight", "원두", 30.0, 31.0)).toBe(
      "원두를 1.0g 더 썼습니다.",
    );
  });

  it("AC-SMALL-02 · 덜 쓴 무게를 말한다", () => {
    expect(diffPhrase("weight", "물", 500.0, 498.0)).toBe(
      "물을 2.0g 덜 썼습니다.",
    );
  });

  it("AC-SMALL-03 · 시간은 빠르다/늦다로 말한다", () => {
    expect(diffPhrase("duration", "추출", 210, 195)).toBe(
      "15초 빨리 끝났습니다.",
    );
    expect(diffPhrase("duration", "추출", 210, 225)).toBe(
      "15초 늦게 끝났습니다.",
    );
  });

  it("AC-SMALL-04 · 온도는 높다/낮다로 말한다", () => {
    expect(diffPhrase("temperature", "물", 93, 96)).toBe(
      "3°C 높게 내렸습니다.",
    );
    expect(diffPhrase("temperature", "물", 93, 90)).toBe(
      "3°C 낮게 내렸습니다.",
    );
  });

  it("AC-SMALL-05 · 같으면 문구가 없다", () => {
    expect(diffPhrase("weight", "원두", 30.0, 30.0)).toBeNull();
  });

  it("AC-SMALL-06 · 기준값이 없으면 문구가 없다", () => {
    // 비교할 대상이 없으면 차이를 말하지 않는다.
    expect(diffPhrase("temperature", "물", undefined, 92)).toBeNull();
    expect(diffPhrase("weight", "원두", 30.0, undefined)).toBeNull();
  });

  it("시간 차이는 시점이 아니라 초·분으로 말한다", () => {
    // formatDuration은 `3:30`처럼 시점을 적는다 — 「0:15 빨리」는 읽히지 않는다.
    expect(diffPhrase("duration", "추출", 210, 195)).toContain("15초");
    expect(diffPhrase("duration", "추출", 210, 330)).toContain("2분");
    expect(diffPhrase("duration", "추출", 210, 285)).toContain("1분 15초");
  });

  it("조사가 받침에 맞는다", () => {
    // 「원두를」·「물을」 — 받침 유무로 갈린다.
    expect(diffPhrase("weight", "원두", 30, 31)).toContain("원두를");
    expect(diffPhrase("weight", "물", 500, 501)).toContain("물을");
  });
});
