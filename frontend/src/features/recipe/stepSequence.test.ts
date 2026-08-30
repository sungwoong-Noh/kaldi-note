import { describe, expect, it } from "vitest";
import {
  appendStep,
  insertStepAfter,
  moveStep,
  pouredWaterTotal,
  removeStep,
  type EditableStep,
} from "./stepSequence";

function step(
  over: Partial<EditableStep> & { uid: string },
): EditableStep {
  return {
    stepType: "POUR",
    startAtSeconds: 0,
    durationSeconds: 10,
    waterG: null,
    pourTechnique: null,
    agitation: null,
    note: null,
    ...over,
  };
}

const startsOf = (steps: EditableStep[]) =>
  steps.map((s) => s.startAtSeconds);

describe("appendStep", () => {
  it("첫 스텝은 BLOOM으로 0초에 시작한다", () => {
    const [created] = appendStep([]);

    expect(created).toMatchObject({
      stepType: "BLOOM",
      startAtSeconds: 0,
      durationSeconds: 10,
      waterG: null,
    });
  });

  it("두 번째 스텝은 POUR로 앞 스텝 종료 시각에 시작한다", () => {
    const steps = [step({ uid: "a", stepType: "BLOOM", startAtSeconds: 0, durationSeconds: 10 })];

    const next = appendStep(steps);

    expect(next[1]).toMatchObject({ stepType: "POUR", startAtSeconds: 10 });
  });

  it("uid는 스텝마다 다르다", () => {
    const next = appendStep(appendStep([]));

    expect(next[0].uid).not.toBe(next[1].uid);
  });
});

describe("insertStepAfter", () => {
  it("자리가 남으면 뒤 스텝을 밀지 않는다", () => {
    const steps = [
      step({ uid: "a", startAtSeconds: 0 }),
      step({ uid: "b", startAtSeconds: 45 }),
    ];

    expect(startsOf(insertStepAfter(steps, 0))).toEqual([0, 10, 45]);
  });

  it("자리가 5초 부족하면 뒤를 정확히 5초 민다", () => {
    const steps = [
      step({ uid: "a", startAtSeconds: 0 }),
      step({ uid: "b", startAtSeconds: 15 }),
    ];

    expect(startsOf(insertStepAfter(steps, 0))).toEqual([0, 10, 20]);
  });

  it("맨 뒤에 삽입하면 밀 대상이 없다", () => {
    const steps = [step({ uid: "a", startAtSeconds: 0 })];

    expect(startsOf(insertStepAfter(steps, 0))).toEqual([0, 10]);
  });
});

describe("removeStep", () => {
  it("다음 스텝 시작까지의 간격만큼 뒤를 당긴다", () => {
    const steps = [
      step({ uid: "a", startAtSeconds: 0 }),
      step({ uid: "b", startAtSeconds: 45 }),
      step({ uid: "c", startAtSeconds: 90 }),
    ];

    expect(startsOf(removeStep(steps, 1))).toEqual([0, 45]);
  });

  it("마지막 스텝을 지우면 아무것도 움직이지 않는다", () => {
    const steps = [
      step({ uid: "a", startAtSeconds: 0 }),
      step({ uid: "b", startAtSeconds: 45 }),
      step({ uid: "c", startAtSeconds: 90 }),
    ];

    expect(startsOf(removeStep(steps, 2))).toEqual([0, 45]);
  });
});

describe("moveStep", () => {
  it("소요는 따라가고 시작 시각은 자리에 남는다", () => {
    const steps = [
      step({ uid: "a", stepType: "BLOOM", startAtSeconds: 0, durationSeconds: 10 }),
      step({ uid: "b", stepType: "WAIT", startAtSeconds: 20, durationSeconds: 10 }),
      step({ uid: "c", stepType: "POUR", startAtSeconds: 45, durationSeconds: 20 }),
    ];

    const next = moveStep(steps, 2, -1);

    expect(next[1]).toMatchObject({ uid: "c", startAtSeconds: 20, durationSeconds: 20 });
    expect(next[2]).toMatchObject({ uid: "b", startAtSeconds: 45, durationSeconds: 10 });
  });

  it("이동 결과 겹치면 뒤 스텝을 겹친 만큼 민다", () => {
    const steps = [
      step({ uid: "a", startAtSeconds: 0, durationSeconds: 10 }),
      step({ uid: "b", stepType: "WAIT", startAtSeconds: 20, durationSeconds: 10 }),
      step({ uid: "c", startAtSeconds: 25, durationSeconds: 20 }),
    ];

    const next = moveStep(steps, 2, -1);

    expect(startsOf(next)).toEqual([0, 20, 40]);
  });

  it("범위 밖으로 이동하면 원본을 그대로 돌려준다", () => {
    const steps = [step({ uid: "a" }), step({ uid: "b", startAtSeconds: 20 })];

    expect(moveStep(steps, 0, -1)).toBe(steps);
  });
});

describe("pouredWaterTotal", () => {
  it("붓는 스텝의 물량만 더한다", () => {
    const steps = [
      step({ uid: "a", stepType: "BLOOM", waterG: 60 }),
      step({ uid: "b", stepType: "WAIT", waterG: null }),
      step({ uid: "c", stepType: "POUR", waterG: 180 }),
    ];

    expect(pouredWaterTotal(steps)).toBe(240);
  });

  it("스텝이 없으면 0이다", () => {
    expect(pouredWaterTotal([])).toBe(0);
  });
});
