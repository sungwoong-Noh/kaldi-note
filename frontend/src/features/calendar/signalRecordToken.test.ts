import { describe, expect, it } from "vitest";
import { readPalettes } from "../../test/tokens";

/** 달력의 기록 점 전용 토큰 — docs/specs/2026-09-19-home-calendar.md */
describe("signal-record 토큰", () => {
  it("AC-HOMECAL-53 · 라이트·다크에서 각각 지정값이다", () => {
    const { light, dark } = readPalettes();

    expect(light["signal-record"]).toBe("oklch(0.55 0.16 30)");
    expect(dark["signal-record"]).toBe("oklch(0.65 0.17 30)");
  });
});
