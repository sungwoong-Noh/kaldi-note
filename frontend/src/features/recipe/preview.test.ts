import { describe, expect, it } from "vitest";
import type { EditableStep } from "./stepSequence";
import { ratioLabel, timeline, waterObservation } from "./preview";

function step(
  stepType: EditableStep["stepType"],
  startAtSeconds: number,
  durationSeconds: number,
  waterG: number | null,
): EditableStep {
  return {
    uid: `${stepType}-${startAtSeconds}`,
    stepType,
    startAtSeconds,
    durationSeconds,
    waterG,
    pourTechnique: null,
    agitation: null,
    note: null,
  };
}

const fourSteps = [
  step("BLOOM", 0, 45, 45),
  step("POUR", 45, 30, 105),
  step("POUR", 90, 30, 100),
  step("DRAWDOWN", 120, 90, null),
];

describe("ratioLabel", () => {
  it("AC-RECIPEEDIT-01 · 원두 16.0 · 물 250.0이면 1:15.6, 원두가 비면 —", () => {
    expect(ratioLabel(16, 250)).toBe("1:15.6");
    expect(ratioLabel(null, 250)).toBe("—");
  });

  it("HALF_UP을 정수로 계산한다 — 196.2 / 12 = 16.35 → 16.4", () => {
    // 부동소수로 나누면 16.349999…라 16.3이 된다.
    expect(ratioLabel(12, 196.2)).toBe("1:16.4");
  });

  it("범위 밖 값이면 계산하지 않는다", () => {
    expect(ratioLabel(0, 250)).toBe("—");
    expect(ratioLabel(16, 3200)).toBe("—");
  });
});

describe("waterObservation", () => {
  const with230 = [step("BLOOM", 0, 45, 45), step("POUR", 45, 30, 185)];
  const with270 = [step("BLOOM", 0, 45, 45), step("POUR", 45, 30, 225)];

  it("AC-RECIPEEDIT-06 · 합계와 총 물량의 차이를 문장으로 말한다", () => {
    expect(waterObservation(with230, 250)).toEqual({
      text: "스텝 물 합계가 총 물량보다 20 g 적습니다. 저장하려면 합계를 맞춰 주세요.",
      mismatch: true,
    });
    expect(waterObservation(with270, 250)).toEqual({
      text: "스텝 물 합계가 총 물량보다 20 g 많습니다. 저장하려면 합계를 맞춰 주세요.",
      mismatch: true,
    });
    expect(waterObservation(fourSteps, 250)).toEqual({
      text: "스텝 물 합계가 총 물량과 같습니다.",
      mismatch: false,
    });
  });

  it("AC-RECIPEEDIT-20 · 스텝이 없으면 문구가 없다", () => {
    expect(waterObservation([], 250)).toBeNull();
  });

  it("차이가 소수면 소수 1자리로 말한다", () => {
    expect(waterObservation(with230, 232.5)?.text).toContain("2.5 g 적습니다");
  });
});

describe("timeline", () => {
  it("AC-RECIPEEDIT-07 · 스텝마다 막대 1개, 누적 물량, 축 0:00 · 중간 · 끝", () => {
    const result = timeline(fourSteps, 210);

    expect(result.bars.map((bar) => [bar.label, bar.cumulative])).toEqual([
      ["뜸", "45"],
      ["붓기", "150"],
      ["붓기", "250"],
      ["배출", "—"],
    ]);
    expect(result.axis).toEqual(["0:00", "1:45", "3:30"]);
  });

  it("축 끝은 총 시간과 마지막 스텝 종료 중 큰 쪽이다", () => {
    expect(timeline(fourSteps, 60).axis.at(-1)).toBe("3:30");
    expect(timeline(fourSteps, null).axis.at(-1)).toBe("3:30");
  });

  it("막대 위치는 축 끝에 대한 백분율이다", () => {
    const [bloom, , , drawdown] = timeline(fourSteps, 210).bars;

    expect(bloom.leftPct).toBe(0);
    expect(bloom.widthPct).toBeCloseTo((45 / 210) * 100);
    expect(drawdown.leftPct + drawdown.widthPct).toBeCloseTo(100);
  });
});
